import { LOCALE } from "@/lib/format"
import { connection } from "next/server"
import { ArrowDown, ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { DAY, formatDay } from "@/lib/format"
import { userCtx } from "@/server/queries/common"
import { getLabs, type LabsVM } from "@/server/queries/bodyLogs"
import { CAPTION, LABEL, StatusChip, Tag } from "@/components/metrics/primitives"
import { DetailShell } from "@/components/shells/DetailShell"
import { EmptyState } from "@/components/shells/EmptyState"
import { SectionShell } from "@/components/shells/SectionShell"
import { SheetTrigger } from "@/components/shells/SheetTrigger"
import { DeleteEntry } from "../../_lib/DeleteEntry"
import { LAB_TONE, LAB_WORD } from "../format"
import { t as tr } from "@/lib/i18n"

export const metadata = { title: tr("Labs") }

const INFO = {
  title: tr("About Labs"),
  body: (
    <>
      <p>{tr("Results you type in from a blood test. Pulse keeps them with your other data and shows each against a reference range.")}</p>
      <p>
        {tr("The default ranges are common adult ranges. Labs differ: when your report prints its own range, enter it with the value and Pulse uses that instead. Pulse says low, in range or high; it does not interpret results. Talk them through with your doctor.")}</p>
    </>
  ),
}

type Item = LabsVM["groups"][number]["items"][number]

const fmt = (v: number, dp: number) => v.toLocaleString(LOCALE, { minimumFractionDigits: dp, maximumFractionDigits: dp })

function rangeText(it: Item) {
  const [lo, hi] = it.range
  if (lo !== null && hi !== null) return `${fmt(lo, it.dp)}–${fmt(hi, it.dp)}`
  if (lo !== null) return tr("over {0}", [fmt(lo, it.dp)])
  if (hi !== null) return tr("under {0}", [fmt(hi, it.dp)])
  return "no range"
}

/** Where the value sits on its range: a short track with the range lit and a dot for the value. */
function RangeBar({ it }: { it: Item }) {
  const [lo, hi] = it.range
  if (lo === null && hi === null) return null
  const a = lo ?? 0
  const b = hi ?? (lo ?? 0) * 2
  const span = Math.max(b - a, 1e-6)
  const min = a - span * 0.5
  const max = b + span * 0.5
  const pos = (x: number) => `${Math.min(100, Math.max(0, ((x - min) / (max - min)) * 100))}%`
  const off = it.status === "low" || it.status === "high"
  return (
    <span aria-hidden className="relative block h-1.5 rounded-full bg-dial-track">
      <span className="absolute inset-y-0 rounded-full bg-optimal/40" style={{ left: lo === null ? "0%" : pos(a), right: hi === null ? "0%" : `calc(100% - ${pos(b)})` }} />
      <span className={cn("absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card", off ? "bg-warning" : "bg-optimal")} style={{ left: pos(it.value) }} />
    </span>
  )
}

function LabRow({ it, history }: { it: Item; history: LabsVM["history"][string] }) {
  const prev = it.previous
  const up = prev ? it.value > prev.value : false
  return (
    <li className="py-3">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-5 font-medium">{it.label}</p>
            <p className={CAPTION}>
              {tr("Range")}{" "}{rangeText(it)} · {formatDay(it.day, DAY.full)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-numeric text-lg font-bold tabular-nums">
              {fmt(it.value, it.dp)}
              <span className="ml-1 text-xs font-medium text-muted-foreground">{it.unit}</span>
            </p>
            {prev && prev.value !== it.value && (
              <p className={cn(CAPTION, "inline-flex items-center gap-0.5 tabular-nums")}>
                {up ? <ArrowUp aria-hidden className="size-3" /> : <ArrowDown aria-hidden className="size-3" />}
                from {fmt(prev.value, it.dp)}
              </p>
            )}
          </div>
          <StatusChip tone={LAB_TONE[it.status]}>{LAB_WORD[it.status]}</StatusChip>
        </summary>
        <div className="mt-3">
          <RangeBar it={it} />
        </div>
        <ul className="mt-3 flex flex-col gap-1">
          {[...history].reverse().map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3">
              <span className={CAPTION}>{formatDay(h.day, DAY.full)}</span>
              <span className="flex items-center gap-2">
                <span className="font-numeric text-[15px] tabular-nums">{fmt(h.value, it.dp)}</span>
                <DeleteEntry kind="lab" id={h.id} label={tr("{0} on {1}", [it.label, formatDay(h.day, DAY.full)])} />
              </span>
            </li>
          ))}
        </ul>
      </details>
    </li>
  )
}

export default async function LabsPage() {
  await connection()
  const vm = await getLabs(await userCtx())
  return (
    <DetailShell
      title={tr("Labs")}
      info={INFO}
      backHref="/health"
      action={<Tag kind="beta" />}
      hero={
        vm.lastTest ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <p className="font-numeric text-[64px] leading-none font-bold tabular-nums">{vm.outOfRange}</p>
            <p className={LABEL}>{vm.outOfRange === 1 ? tr("Marker out of range") : "Markers out of range"}</p>
            <p className={CAPTION}>{tr("Last test")}{" "}{formatDay(vm.lastTest, DAY.full)}</p>
          </div>
        ) : (
          <EmptyState body={tr("No results yet. Enter the values from your last blood test; Pulse tracks each marker over time.")} />
        )
      }
      summary={
        <SheetTrigger
          sheet="labs"
          className="inline-flex h-14 w-full items-center justify-center rounded-full bg-primary px-6 text-[15px] font-bold tracking-[0.1em] text-primary-foreground uppercase outline-none hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {tr("Log results")}</SheetTrigger>
      }
      secondary={vm.groups.map((g) => (
        <SectionShell key={g.key} variant="card" title={g.label}>
          <ul className="divide-y divide-border">
            {g.items.map((it) => (
              <LabRow key={it.key} it={it} history={vm.history[it.key] ?? []} />
            ))}
          </ul>
        </SectionShell>
      ))}
    />
  )
}
