import Foundation
import HealthKit
import WebKit

/// Apple Health → Pulse. Reads blood pressure, weight, body fat and water from HealthKit and posts what is new or
/// deleted since the last run to `<server>/api/apple-health`, signed in with the WebView's session cookie. Anchors are
/// kept per server, so each sample is sent once; a failed run keeps its anchors and sends the same changes next time.
/// Runs when the user connects in Settings, when they tap "Sync now", and each time the app comes to the foreground.
final class HealthSync {
    static let shared = HealthSync()

    enum Failure: String, Error {
        case signedOut = "signed_out"
        case denied
        case network
        case server
    }

    private struct Kind {
        let key: String
        let type: HKSampleType
    }

    private static let historyDays: Double = 365
    private static let chunk = 500
    private let store = HKHealthStore()
    private let enabledKey = "pulse.health.enabled"
    private let lastSyncKey = "pulse.health.lastSync"

    private(set) var syncing = false
    private var lastWritten: Int?
    private var lastError: Failure?
    /// Called on the main queue whenever the state changes, so the page can show it.
    var onChange: (() -> Void)?

    var available: Bool { HKHealthStore.isHealthDataAvailable() }
    var enabled: Bool { UserDefaults.standard.bool(forKey: enabledKey) }
    private var lastSync: Date? { UserDefaults.standard.object(forKey: lastSyncKey) as? Date }

    private lazy var kinds: [Kind] = {
        var out: [Kind] = []
        if let t = HKObjectType.correlationType(forIdentifier: .bloodPressure) { out.append(Kind(key: "bp", type: t)) }
        if let t = HKObjectType.quantityType(forIdentifier: .bodyMass) { out.append(Kind(key: "weight", type: t)) }
        if let t = HKObjectType.quantityType(forIdentifier: .bodyFatPercentage) { out.append(Kind(key: "bodyFat", type: t)) }
        if let t = HKObjectType.quantityType(forIdentifier: .dietaryWater) { out.append(Kind(key: "water", type: t)) }
        return out
    }()

    /// What the user is asked to allow. Correlations can't be requested; their parts can.
    private var readTypes: Set<HKObjectType> {
        let ids: [HKQuantityTypeIdentifier] = [.bloodPressureSystolic, .bloodPressureDiastolic, .bodyMass, .bodyFatPercentage, .dietaryWater]
        return Set(ids.compactMap { HKObjectType.quantityType(forIdentifier: $0) })
    }

    /// The state the Settings card shows, as a JSON-able dictionary.
    func state() -> [String: Any] {
        return [
            "available": available,
            "enabled": enabled,
            "syncing": syncing,
            "lastSync": lastSync.map { ($0.timeIntervalSince1970 * 1000) as Any } ?? (NSNull() as Any),
            "written": lastWritten.map { $0 as Any } ?? (NSNull() as Any),
            "error": lastError.map { $0.rawValue as Any } ?? (NSNull() as Any),
            "at": Date().timeIntervalSince1970 * 1000,
        ]
    }

    /// Asks for read access (iOS shows its sheet the first time only), turns syncing on and runs it.
    func connect() {
        guard available else { return }
        store.requestAuthorization(toShare: nil, read: readTypes) { [weak self] ok, _ in
            DispatchQueue.main.async {
                guard let self = self else { return }
                if ok {
                    UserDefaults.standard.set(true, forKey: self.enabledKey)
                    self.sync()
                } else {
                    self.lastError = .denied
                    self.notify()
                }
            }
        }
    }

    /// Sends what changed since the last run. Does nothing until connected, without a server, or while running.
    func sync() {
        guard available, enabled, !syncing, let server = ServerStore.url, let base = URL(string: server) else { return }
        syncing = true
        lastError = nil
        notify()
        Task {
            let result = await self.run(base)
            await MainActor.run {
                self.syncing = false
                switch result {
                case .success(let written):
                    self.lastWritten = written
                    UserDefaults.standard.set(Date(), forKey: self.lastSyncKey)
                case .failure(let failure):
                    self.lastError = failure
                }
                self.notify()
            }
        }
    }

    private func notify() {
        onChange?()
    }

    // MARK: - One run

    private func run(_ base: URL) async -> Result<Int, Failure> {
        let cookies = await sessionCookies(for: base)
        var written = 0
        for kind in kinds {
            // A type the user didn't allow, or one HealthKit can't read right now, is skipped; the others still go.
            guard let change = await changes(kind, server: base) else { continue }
            let samples = change.samples.compactMap { payload(kind, $0) }
            let deleted = change.deleted.map { $0.uuid.uuidString }
            var start = 0
            while start < samples.count || start < deleted.count {
                let part = Array(samples[min(start, samples.count)..<min(start + Self.chunk, samples.count)])
                let gone = Array(deleted[min(start, deleted.count)..<min(start + Self.chunk, deleted.count)])
                switch await post(base, cookies: cookies, samples: part, deleted: gone) {
                case .success(let n): written += n
                case .failure(let failure): return .failure(failure)
                }
                start += Self.chunk
            }
            saveAnchor(change.anchor, kind: kind, server: base)
        }
        return .success(written)
    }

    private func changes(_ kind: Kind, server: URL) async -> (samples: [HKSample], deleted: [HKDeletedObject], anchor: HKQueryAnchor?)? {
        let since = Date().addingTimeInterval(-Self.historyDays * 86_400)
        let predicate = HKQuery.predicateForSamples(withStart: since, end: nil, options: [])
        let anchor = loadAnchor(kind: kind, server: server)
        return await withCheckedContinuation { (cont: CheckedContinuation<(samples: [HKSample], deleted: [HKDeletedObject], anchor: HKQueryAnchor?)?, Never>) in
            let query = HKAnchoredObjectQuery(type: kind.type, predicate: predicate, anchor: anchor, limit: HKObjectQueryNoLimit) { _, samples, deleted, newAnchor, error in
                if error != nil {
                    cont.resume(returning: nil)
                } else {
                    cont.resume(returning: (samples: samples ?? [], deleted: deleted ?? [], anchor: newAnchor))
                }
            }
            store.execute(query)
        }
    }

    private func payload(_ kind: Kind, _ sample: HKSample) -> [String: Any]? {
        var p: [String: Any] = ["kind": kind.key, "id": sample.uuid.uuidString, "ts": Int(sample.startDate.timeIntervalSince1970)]
        switch kind.key {
        case "bp":
            guard let c = sample as? HKCorrelation,
                  let sysType = HKObjectType.quantityType(forIdentifier: .bloodPressureSystolic),
                  let diaType = HKObjectType.quantityType(forIdentifier: .bloodPressureDiastolic),
                  let sys = c.objects(for: sysType).first as? HKQuantitySample,
                  let dia = c.objects(for: diaType).first as? HKQuantitySample else { return nil }
            p["systolic"] = sys.quantity.doubleValue(for: .millimeterOfMercury())
            p["diastolic"] = dia.quantity.doubleValue(for: .millimeterOfMercury())
        case "weight":
            guard let q = sample as? HKQuantitySample else { return nil }
            p["value"] = q.quantity.doubleValue(for: .gramUnit(with: .kilo))
        case "bodyFat":
            guard let q = sample as? HKQuantitySample else { return nil }
            p["value"] = q.quantity.doubleValue(for: .percent()) * 100
        case "water":
            guard let q = sample as? HKQuantitySample else { return nil }
            p["value"] = q.quantity.doubleValue(for: .literUnit(with: .milli))
        default:
            return nil
        }
        return p
    }

    // MARK: - Server

    private func post(_ base: URL, cookies: [HTTPCookie], samples: [[String: Any]], deleted: [String]) async -> Result<Int, Failure> {
        guard let url = URL(string: "api/apple-health", relativeTo: base),
              let body = try? JSONSerialization.data(withJSONObject: ["samples": samples, "deleted": deleted]) else { return .failure(.server) }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = body
        request.httpShouldHandleCookies = false
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        for (name, value) in HTTPCookie.requestHeaderFields(with: cookies) {
            request.setValue(value, forHTTPHeaderField: name)
        }
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let http = response as? HTTPURLResponse
            // Without a session the server sends the request to its sign-in page.
            if http?.statusCode == 401 || http?.url?.path.hasPrefix("/login") == true { return .failure(.signedOut) }
            guard http?.statusCode == 200,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let written = json["written"] as? Int else { return .failure(.server) }
            return .success(written)
        } catch {
            return .failure(.network)
        }
    }

    /// The cookies the WebView holds for the server: its session, the same one the pages use.
    private func sessionCookies(for base: URL) async -> [HTTPCookie] {
        let host = base.host ?? ""
        let cookies = await withCheckedContinuation { (cont: CheckedContinuation<[HTTPCookie], Never>) in
            DispatchQueue.main.async {
                WKWebsiteDataStore.default().httpCookieStore.getAllCookies { cont.resume(returning: $0) }
            }
        }
        return cookies.filter { cookie in
            let domain = cookie.domain.hasPrefix(".") ? String(cookie.domain.dropFirst()) : cookie.domain
            return host == domain || host.hasSuffix("." + domain)
        }
    }

    // MARK: - Anchors

    private func anchorKey(_ kind: Kind, _ server: URL) -> String {
        "pulse.health.anchor.\(server.host ?? "").\(kind.key)"
    }

    private func loadAnchor(kind: Kind, server: URL) -> HKQueryAnchor? {
        guard let data = UserDefaults.standard.data(forKey: anchorKey(kind, server)) else { return nil }
        return try? NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: data)
    }

    private func saveAnchor(_ anchor: HKQueryAnchor?, kind: Kind, server: URL) {
        guard let anchor = anchor, let data = try? NSKeyedArchiver.archivedData(withRootObject: anchor, requiringSecureCoding: true) else { return }
        UserDefaults.standard.set(data, forKey: anchorKey(kind, server))
    }
}

/// The page's side of it: Settings posts `{ action: "status" | "connect" | "sync" }` to `pulseHealth` and hears back
/// through a `pulse-health` event. Answered only for the saved server's own pages; anything else is ignored.
final class HealthMessages: NSObject, WKScriptMessageHandler {
    private weak var webView: WKWebView?

    init(webView: WKWebView) {
        self.webView = webView
        super.init()
        HealthSync.shared.onChange = { [weak self] in self?.publish() }
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let server = ServerStore.url, let allowed = URL(string: server) else { return }
        let origin = message.frameInfo.securityOrigin
        let port: Int? = (origin.port == 0 || origin.port == 443) ? nil : origin.port
        guard origin.protocol == "https", origin.host == allowed.host, port == allowed.port else { return }
        guard let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        switch action {
        case "connect": HealthSync.shared.connect()
        case "sync": HealthSync.shared.sync()
        default: break
        }
        publish()
    }

    func publish() {
        guard let webView = webView,
              let data = try? JSONSerialization.data(withJSONObject: HealthSync.shared.state()),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('pulse-health', { detail: \(json) }))", completionHandler: nil)
    }
}
