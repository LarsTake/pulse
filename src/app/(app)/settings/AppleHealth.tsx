"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { HeartPulse, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ago } from "@/lib/format";
import { t as tr, UI_LOCALE } from "@/lib/i18n";
import { SectionShell } from "@/components/shells/SectionShell";
import { Button } from "@/components/ui/button";

/**
 * Apple Health, in the iOS app only. The app reads HealthKit itself (mobile/ios/App/App/HealthSync.swift) and posts
 * to /api/apple-health; this page talks to it through the `pulseHealth` message handler, which the app answers only
 * for its own server, with a `pulse-health` event carrying its state.
 */
type NativeState = {
  available: boolean;
  enabled: boolean;
  syncing: boolean;
  /** Epoch ms of the last sync that reached the server. */
  lastSync: number | null;
  written: number | null;
  error: "signed_out" | "denied" | "network" | "server" | null;
  /** Epoch ms when the app sent this state. */
  at: number;
};

type Bridge = {
  postMessage: (m: { action: "status" | "connect" | "sync" }) => void;
};
const bridge = (): Bridge | null =>
  typeof window === "undefined"
    ? null
    : ((
        window as unknown as {
          webkit?: { messageHandlers?: { pulseHealth?: Bridge } };
        }
      ).webkit?.messageHandlers?.pulseHealth ?? null);

let state: NativeState | null = null;
const listeners = new Set<() => void>();
const onEvent = (e: Event) => {
  state = (e as CustomEvent<NativeState>).detail;
  listeners.forEach((l) => l());
};
function subscribe(fn: () => void) {
  if (listeners.size === 0) {
    window.addEventListener("pulse-health", onEvent);
    bridge()?.postMessage({ action: "status" });
  }
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0)
      window.removeEventListener("pulse-health", onEvent);
  };
}

const ERROR: Record<NonNullable<NativeState["error"]>, string> = {
  signed_out: "Signed out. Sign in again, then sync.",
  denied:
    "Pulse can’t read Apple Health. Allow it in Settings › Health › Data Access & Devices › Pulse.",
  network:
    "Couldn’t reach your server. Pulse tries again next time the app opens.",
  server: "Your server didn’t accept the data. Try again later.",
};

const BODY =
  "max-w-[65ch] text-[15px] leading-[22px] text-pretty text-foreground-secondary";
const TILE =
  "grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-foreground/[0.06]";

export function AppleHealthCard() {
  const native = React.useSyncExternalStore(
    subscribe,
    () => (bridge() ? state : null),
    () => null,
  );
  const inApp = React.useSyncExternalStore(
    () => () => {},
    () => bridge() !== null,
    () => false,
  );
  const router = useRouter();
  const last = React.useRef<number | null>(null);

  // A finished sync that wrote something: show it, and refresh the screens that read it.
  React.useEffect(() => {
    if (!native?.lastSync || native.lastSync === last.current) return;
    const first = last.current === null;
    last.current = native.lastSync;
    if (!first && native.written) {
      toast.success(tr("{0} values from Apple Health", [native.written]), {
        id: "apple-health",
      });
      router.refresh();
    }
  }, [native?.lastSync, native?.written, router]);

  if (!inApp || (native && !native.available)) return null;
  const send = (action: "connect" | "sync") =>
    bridge()?.postMessage({ action });
  const syncing = native?.syncing ?? false;

  return (
    <SectionShell
      variant="card"
      level={2}
      id="apple-health"
      title={tr("Apple Health")}
    >
      <div className="flex min-h-11 items-center gap-3">
        <span aria-hidden className={TILE}>
          <HeartPulse className="size-5 text-[#ff2d55]" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-[22px] font-semibold">
            {tr("Apple Health")}
          </p>
          <p className="truncate text-[13px] leading-[18px] text-muted-foreground tabular-nums">
            {!native?.enabled
              ? tr("Not connected")
              : native.lastSync
                ? tr("Synced {0}", [
                    UI_LOCALE === "de"
                      ? ago(native.lastSync, native.at)
                      : ago(native.lastSync, native.at).toLowerCase(),
                  ])
                : tr("Not synced yet")}
          </p>
        </div>
      </div>
      <p className={cn(BODY, "mt-3")}>
        {tr(
          "Pulse reads blood pressure, weight, body fat and water from Apple Health on this iPhone, for example from a cuff or a scale. It stays in Pulse and isn’t written to Google.",
        )}
      </p>
      {native?.error && (
        <p
          role="alert"
          className="mt-3 text-[13px] leading-[18px] text-pretty text-warning-text"
        >
          {tr(ERROR[native.error])}
        </p>
      )}
      <div className="mt-4">
        {native?.enabled ? (
          <Button
            type="button"
            variant="secondary"
            size="touch"
            className="w-full"
            onClick={() => send("sync")}
            disabled={syncing}
            aria-busy={syncing || undefined}
          >
            <RefreshCw
              aria-hidden
              strokeWidth={2}
              className={cn(
                syncing && "animate-spin motion-reduce:animate-none",
              )}
            />
            {syncing ? tr("Syncing…") : tr("Sync now")}
          </Button>
        ) : (
          <Button
            type="button"
            size="touch"
            className="w-full"
            onClick={() => send("connect")}
            disabled={syncing}
          >
            {tr("Connect Apple Health")}
          </Button>
        )}
      </div>
      {native?.enabled && (
        <p className="mt-2 text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {tr("Syncs each time you open the app.")}
        </p>
      )}
    </SectionShell>
  );
}
