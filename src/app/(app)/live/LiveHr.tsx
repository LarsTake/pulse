"use client"

import * as React from "react"
import { Bluetooth, BluetoothOff, Heart, Pause, Play, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { DATA_COLORS, ZONE_COLOR } from "@/lib/bands"
import { formatValue, hmm } from "@/lib/format"
import { edwardsTRIMP, toStrainScale, trimpToStrain } from "@/core/scoring/strain"
import { zoneNumber, zones, ZONE_NAMES } from "@/core/scoring/zones"
import type { LiveHrVM } from "@/server/queries/bodyLogs"
import { useBluetoothSupport } from "@/hooks/use-bluetooth"
import { CAPTION, LABEL } from "@/components/metrics/primitives"
import { Button } from "@/components/ui/button"
import { CARD_MATERIAL } from "@/components/ui/card"

// Web Bluetooth is not in TypeScript's DOM lib; the few members used here.
type Characteristic = EventTarget & { value: DataView | null; startNotifications(): Promise<Characteristic>; stopNotifications(): Promise<Characteristic> }
type Gatt = { connected: boolean; connect(): Promise<Gatt>; disconnect(): void; getPrimaryService(s: string): Promise<{ getCharacteristic(c: string): Promise<Characteristic> }> }
type Device = EventTarget & { name?: string; gatt?: Gatt }
type BluetoothApi = { requestDevice(o: { filters: { services: string[] }[]; optionalServices?: string[] }): Promise<Device> }

/** Heart Rate Measurement (GATT 0x2A37): flags, then bpm as uint8 or uint16, optional energy, then RR in 1/1024 s. */
export function parseHrm(v: DataView): { bpm: number; rr: number[] } {
  const flags = v.getUint8(0)
  const wide = flags & 0x01
  let i = 1
  const bpm = wide ? v.getUint16(i, true) : v.getUint8(i)
  i += wide ? 2 : 1
  if (flags & 0x08) i += 2 // energy expended
  const rr: number[] = []
  if (flags & 0x10) for (; i + 1 < v.byteLength; i += 2) rr.push((v.getUint16(i, true) / 1024) * 1000)
  return { bpm, rr }
}

type Sample = { ts: number; bpm: number }
type Status = "idle" | "connecting" | "live" | "lost" | "error"

const WINDOW_S = 5 * 60
const RR_WINDOW = 60

/** RMSSD in ms of successive RR intervals (Task Force 1996), after dropping beats that jump over 20% (ectopics). */
export function rmssd(rr: number[]): number | null {
  const ok = rr.filter((x, i) => x > 300 && x < 2000 && (i === 0 || Math.abs(x - rr[i - 1]) / rr[i - 1] < 0.2))
  if (ok.length < 20) return null
  let s = 0
  for (let i = 1; i < ok.length; i++) s += (ok[i] - ok[i - 1]) ** 2
  return Math.sqrt(s / (ok.length - 1))
}

function Spark({ samples, lo, hi }: { samples: Sample[]; lo: number; hi: number }) {
  if (samples.length < 2) return <div className="h-24" />
  const t1 = samples.at(-1)!.ts
  const t0 = t1 - WINDOW_S
  const y = (b: number) => 96 - ((b - lo) / Math.max(1, hi - lo)) * 88 - 4
  const x = (t: number) => ((t - t0) / WINDOW_S) * 300
  const d = samples.filter((s) => s.ts >= t0).map((s, i) => `${i ? "L" : "M"}${x(s.ts).toFixed(1)},${y(s.bpm).toFixed(1)}`).join(" ")
  return (
    <svg viewBox="0 0 300 96" preserveAspectRatio="none" className="h-24 w-full" aria-hidden>
      <path d={d} fill="none" stroke="var(--recovery-red)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Live heart rate (`/live`): the band's standard Heart Rate service over Web Bluetooth. Nothing leaves the browser:
 * the screen shows bpm, zone, a 5-minute trace, and, while the timer runs, time in zones, average, max and the
 * session's Strain on the same Edwards scale as the day's. With beat-to-beat intervals it adds a live RMSSD.
 */
export function LiveHr({ vm }: { vm: LiveHrVM }) {
  const bt = (typeof navigator !== "undefined" ? (navigator as Navigator & { bluetooth?: BluetoothApi }).bluetooth : undefined) ?? null
  const supported = useBluetoothSupport()

  const [status, setStatus] = React.useState<Status>("idle")
  const [error, setError] = React.useState<string | null>(null)
  const [device, setDevice] = React.useState<string | null>(null)
  const [bpm, setBpm] = React.useState<number | null>(null)
  const [trace, setTrace] = React.useState<Sample[]>([])
  const [hrv, setHrv] = React.useState<number | null>(null)
  const [running, setRunning] = React.useState(false)
  const [session, setSession] = React.useState<Sample[]>([])
  const [elapsed, setElapsed] = React.useState(0)

  const devRef = React.useRef<Device | null>(null)
  const chrRef = React.useRef<Characteristic | null>(null)
  const rrRef = React.useRef<number[]>([])
  const runningRef = React.useRef(false)
  const startRef = React.useRef<{ at: number; before: number } | null>(null)
  const lockRef = React.useRef<{ release(): Promise<void> } | null>(null)

  const set = React.useMemo(() => zones(vm.restingHr, vm.maxHr), [vm.restingHr, vm.maxHr])
  const reserve = Math.max(1, vm.maxHr - vm.restingHr)

  const onValue = React.useCallback((e: Event) => {
    const v = (e.target as Characteristic).value
    if (!v) return
    const { bpm: b, rr } = parseHrm(v)
    if (b <= 0) return
    const ts = Date.now() / 1000
    setBpm(b)
    setTrace((t) => [...t.filter((s) => s.ts > ts - WINDOW_S), { ts, bpm: b }])
    if (rr.length) {
      rrRef.current = [...rrRef.current, ...rr].slice(-RR_WINDOW)
      setHrv(rmssd(rrRef.current))
    }
    if (runningRef.current) setSession((s) => [...s, { ts, bpm: b }])
  }, [])

  const onDisconnect = React.useCallback(() => {
    setStatus("lost")
    setBpm(null)
  }, [])

  async function subscribe(dev: Device) {
    const gatt = await dev.gatt!.connect()
    const svc = await gatt.getPrimaryService("heart_rate")
    const chr = await svc.getCharacteristic("heart_rate_measurement")
    chr.addEventListener("characteristicvaluechanged", onValue)
    await chr.startNotifications()
    chrRef.current = chr
    setStatus("live")
  }

  async function connect() {
    if (!bt) return
    setError(null)
    setStatus("connecting")
    try {
      const dev = await bt.requestDevice({ filters: [{ services: ["heart_rate"] }] })
      devRef.current = dev
      setDevice(dev.name ?? "Heart rate sensor")
      dev.addEventListener("gattserverdisconnected", onDisconnect)
      await subscribe(dev)
    } catch (e) {
      const name = (e as Error).name
      setStatus(name === "NotFoundError" ? "idle" : "error")
      if (name !== "NotFoundError") setError((e as Error).message || "Could not connect")
    }
  }

  async function reconnect() {
    if (!devRef.current) return connect()
    setStatus("connecting")
    try {
      await subscribe(devRef.current)
    } catch (e) {
      setStatus("error")
      setError((e as Error).message || "Could not reconnect")
    }
  }

  function disconnect() {
    chrRef.current?.removeEventListener("characteristicvaluechanged", onValue)
    devRef.current?.removeEventListener("gattserverdisconnected", onDisconnect)
    devRef.current?.gatt?.disconnect()
    devRef.current = null
    chrRef.current = null
    setStatus("idle")
    setBpm(null)
    setDevice(null)
  }

  React.useEffect(() => () => disconnect(), []) // eslint-disable-line react-hooks/exhaustive-deps

  // The timer and a screen wake lock while a session runs.
  React.useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const s = startRef.current
      if (s) setElapsed(s.before + (Date.now() / 1000 - s.at))
    }, 1000)
    const nav = navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }
    nav.wakeLock
      ?.request("screen")
      .then((l) => (lockRef.current = l))
      .catch(() => {})
    return () => {
      clearInterval(id)
      lockRef.current?.release().catch(() => {})
      lockRef.current = null
    }
  }, [running])

  const toggle = () => {
    if (running) {
      startRef.current = null
      runningRef.current = false
      setRunning(false)
    } else {
      startRef.current = { at: Date.now() / 1000, before: elapsed }
      runningRef.current = true
      setRunning(true)
    }
  }
  const reset = () => {
    runningRef.current = false
    setRunning(false)
    startRef.current = null
    setSession([])
    setElapsed(0)
  }

  // Session stats: samples hold until the next, capped at 5 s (a dropped link is not credited).
  const stats = React.useMemo(() => {
    if (session.length < 2) return null
    const durations = session.map((s, i) => Math.min(5, (session[i + 1]?.ts ?? s.ts + 1) - s.ts) / 60)
    const zoneSec = [0, 0, 0, 0, 0]
    session.forEach((s, i) => {
      const z = zoneNumber(set, s.bpm)
      if (z > 0) zoneSec[z - 1] += durations[i] * 60
    })
    const trimp = edwardsTRIMP(session, vm.restingHr, reserve, durations)
    return {
      avg: Math.round(session.reduce((n, s) => n + s.bpm, 0) / session.length),
      max: Math.max(...session.map((s) => s.bpm)),
      strain: toStrainScale(trimpToStrain(trimp)),
      zoneSec,
    }
  }, [session, set, vm.restingHr, reserve])

  if (supported === false)
    return (
      <div className={cn(CARD_MATERIAL, "flex flex-col items-center gap-3 p-6 text-center")}>
        <BluetoothOff aria-hidden strokeWidth={1.75} className="size-8 text-muted-foreground" />
        <p className="text-[17px] leading-6 font-semibold">This browser can’t reach Bluetooth</p>
        <p className="max-w-[48ch] text-[15px] leading-[22px] text-pretty text-foreground-secondary">
          Open Pulse in Chrome or Edge on a computer or an Android phone. Safari and the iPhone don’t offer Web Bluetooth.
        </p>
      </div>
    )

  const zone = bpm === null ? 0 : zoneNumber(set, bpm)
  const color = zone ? DATA_COLORS[ZONE_COLOR[zone]].css : "var(--dial-track)"
  const pct = bpm === null ? null : Math.round(Math.min(100, Math.max(0, ((bpm - vm.restingHr) / reserve) * 100)))
  const lo = Math.min(vm.restingHr, ...trace.map((s) => s.bpm)) - 5
  const hi = Math.max(vm.restingHr + reserve * 0.6, ...trace.map((s) => s.bpm)) + 5
  const totalZone = stats ? stats.zoneSec.reduce((a, b) => a + b, 0) : 0

  return (
    <div className="flex flex-col gap-4">
      {/* The dial: a ring in the zone's colour with bpm inside; it pulses with each reading. */}
      <div className="flex flex-col items-center gap-3 py-2">
        <div
          role="img"
          aria-label={bpm === null ? "No heart rate" : `${bpm} beats per minute, ${zone ? ZONE_NAMES[zone - 1] : "below zone 1"}`}
          className="relative grid size-64 place-items-center rounded-full md:size-70"
          style={{ background: `radial-gradient(circle at 50% 45%, color-mix(in srgb, ${color} 28%, transparent), transparent 70%)` }}
        >
          <span aria-hidden className="absolute inset-0 rounded-full border-[14px] transition-colors duration-500" style={{ borderColor: color }} />
          <div className="text-center">
            <Heart aria-hidden fill="currentColor" strokeWidth={0} className={cn("mx-auto size-8 text-recovery-red", status === "live" && "animate-pulse motion-reduce:animate-none")} />
            <p className="font-numeric text-[88px] leading-none font-bold tabular-nums">{bpm ?? "--"}</p>
            <p className={cn(LABEL, "mt-1")}>{bpm === null ? "bpm" : zone ? `${ZONE_NAMES[zone - 1]} · ${pct}%` : `Below zone 1 · ${pct}%`}</p>
          </div>
        </div>
        <p className={cn(CAPTION, "flex items-center gap-1.5")} aria-live="polite">
          <Bluetooth aria-hidden className="size-3.5" />
          {status === "live" ? device : status === "connecting" ? "Connecting…" : status === "lost" ? `${device} disconnected` : "Not connected"}
          {hrv !== null && status === "live" && <span className="ml-2 tabular-nums">· HRV {Math.round(hrv)} ms</span>}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {status === "live" ? (
          <>
            <Button size="sheet" onClick={toggle}>
              {running ? <Pause aria-hidden /> : <Play aria-hidden />}
              {running ? "Pause session" : elapsed ? "Resume session" : "Start session"}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sheet" variant="outline-pill" onClick={reset} disabled={!elapsed}>
                <RotateCcw aria-hidden /> Reset
              </Button>
              <Button size="sheet" variant="outline-pill" onClick={disconnect}>
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <Button size="sheet" onClick={status === "lost" ? reconnect : connect} disabled={status === "connecting" || supported === null}>
            <Bluetooth aria-hidden />
            {status === "lost" ? "Reconnect" : "Connect band"}
          </Button>
        )}
        {error && <p className="text-center text-[15px] text-recovery-red-text">{error}</p>}
      </div>

      <section className={cn(CARD_MATERIAL, "p-4")}>
        <h2 className={LABEL}>Last 5 minutes</h2>
        <Spark samples={trace} lo={lo} hi={hi} />
      </section>

      <section className={cn(CARD_MATERIAL, "p-4")}>
        <div className="flex items-baseline justify-between">
          <h2 className={LABEL}>Session</h2>
          <span className="font-numeric text-xl font-bold tabular-nums">{hmm(elapsed / 60)}</span>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
          {[
            ["Strain", stats ? formatValue("decimal1", stats.strain) : "--", "text-strain-text"],
            ["Avg bpm", stats ? String(stats.avg) : "--", ""],
            ["Max bpm", stats ? String(stats.max) : "--", ""],
          ].map(([k, v, c]) => (
            <div key={k}>
              <dd className={cn("font-numeric text-2xl font-bold tabular-nums", c)}>{v}</dd>
              <dt className={CAPTION}>{k}</dt>
            </div>
          ))}
        </dl>
        <ul className="mt-4 flex flex-col gap-2">
          {ZONE_NAMES.map((name, i) => {
            const sec = stats?.zoneSec[i] ?? 0
            return (
              <li key={name} className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-3">
                <span className={CAPTION}>{name}</span>
                <span className="h-2 rounded-full bg-dial-track" aria-hidden>
                  <span className={cn("block h-full rounded-full", DATA_COLORS[ZONE_COLOR[i + 1]].bg)} style={{ width: `${totalZone ? (sec / totalZone) * 100 : 0}%` }} />
                </span>
                <span className="text-right font-numeric text-[15px] tabular-nums">{hmm(sec / 60)}</span>
              </li>
            )
          })}
        </ul>
        <p className={cn(CAPTION, "mt-3")}>
          Zones on heart-rate reserve: resting {vm.restingHr}
          {vm.restingSource === "default" ? " (default)" : ""}, max {vm.maxHr} bpm. Shown here only; your day’s Strain still comes from the band’s sync.
        </p>
      </section>
    </div>
  )
}
