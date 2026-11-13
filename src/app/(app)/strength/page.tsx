import { LOCALE } from "@/lib/format"
import { connection } from "next/server"
import { Dumbbell, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import { CARD_MATERIAL } from "@/components/ui/card"
import { DAY, formatDay, formatValue } from "@/lib/format"
import { MUSCLE_LABEL, type VolumeStatus } from "@/core/algorithms/strength"
import { userCtx } from "@/server/queries/common"
import { getStrength, type StrengthVM } from "@/server/queries/bodyLogs"
import { ColumnChart } from "@/components/charts/ColumnChart"
import { CAPTION, LABEL, StatusChip, Tag, ValueUnit } from "@/components/metrics/primitives"
import { ScoreDial } from "@/components/metrics/ScoreDial"
import { DetailShell } from "@/components/shells/DetailShell"
import { EmptyState } from "@/components/shells/EmptyState"
import { SectionShell } from "@/components/shells/SectionShell"
import { SheetTrigger } from "@/components/shells/SheetTrigger"
import { DeleteEntry } from "../_lib/DeleteEntry"
import { t as tr } from "@/lib/i18n"

export const metadata = { title: tr("Strength") }

const INFO = {
  title: tr("About Strength"),
  body: (
    <>
      <p>
        {tr("Log sessions set by set. Pulse counts hard sets per muscle each week (a secondary muscle counts half) against the 10 to 20 sets that most studies find builds muscle best.")}</p>
      <p>
        {tr("Muscular load puts a session on the 0 to 21 Strain scale. A wrist band reads heart rate, and lifting raises heart rate less than it loads muscle; this is the part it misses. It is an estimate from your sets and loads.")}</p>
      <p>{tr("PRs compare each exercise’s estimated one-rep max (Epley) with your best of the past year.")}</p>
    </>
  ),
}

const BAR: Record<VolumeStatus, string> = { none: "bg-transparent", low: "bg-sleep", optimal: "bg-optimal", high: "bg-warning" }
const WORD: Record<VolumeStatus, string> = { none: "—", low: "Low", optimal: "In range", high: "High" }

function LogButton({ label = "Log session" }: { label?: string }) {
  return (
    <SheetTrigger
      sheet="strength"
      className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-[15px] font-bold tracking-[0.1em] text-primary-foreground uppercase outline-none hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Dumbbell aria-hidden strokeWidth={1.75} className="size-5" />
      {label}
    </SheetTrigger>
  )
}

function Hero({ vm }: { vm: StrengthVM }) {
  // Today's load, else the last session's, so the dial is not empty on a rest day.
  const last = vm.sessions[0]
  const today = vm.todayLoad !== null
  const value = today ? vm.todayLoad : (last?.load ?? null)
  const label = today ? "Muscular load today" : last ? `Last session · ${formatDay(last.day, DAY.monthDay)}` : "Muscular load"
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <ScoreDial variant="stat" size="lg" label={label} value={value} color="strain" max={21} format="decimal1" reason={value === null ? "no_data" : null} extraTags={["estimate"]} />
      <p className={CAPTION}>
        {tr("This week:")}{" "}{vm.weekSessions} {vm.weekSessions === 1 ? "session" : "sessions"} · {vm.weekTonnage.toLocaleString(LOCALE)} {" "}{tr("kg moved")}</p>
    </div>
  )
}

function MuscleVolume({ vm }: { vm: StrengthVM }) {
  const max = Math.max(24, ...vm.week.map((w) => w.sets))
  return (
    <SectionShell variant="card" title={tr("Sets per muscle")} action={<span className={CAPTION}>since {formatDay(vm.weekStart, DAY.monthDay)}</span>}>
      <ul className="flex flex-col gap-3">
        {vm.week.map((w) => (
          <li key={w.muscle} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-3">
            <span className="text-[15px] leading-5 font-medium">{MUSCLE_LABEL[w.muscle]}</span>
            <span className="relative h-2.5 rounded-full bg-dial-track" aria-hidden>
              {/* The 10–20 band, behind the bar. */}
              <span className="absolute inset-y-0 rounded-full bg-optimal/15" style={{ left: `${(10 / max) * 100}%`, width: `${(10 / max) * 100}%` }} />
              <span className={cn("absolute inset-y-0 left-0 rounded-full", BAR[w.status])} style={{ width: `${Math.min(100, (w.sets / max) * 100)}%` }} />
            </span>
            <span className="text-right font-numeric text-[15px] tabular-nums">
              {formatValue("decimal1", w.sets).replace(/\.0$/, "")}
              <span className="sr-only"> {" "}{tr("sets,")}{" "}{WORD[w.status]}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className={cn(CAPTION, "mt-4")}>{tr("Shaded: 10–20 hard sets a week. Blue under, green in range, orange over.")}</p>
    </SectionShell>
  )
}

function Weekly({ vm }: { vm: StrengthVM }) {
  return (
    <SectionShell variant="card" title={tr("Weekly volume")}>
      <ColumnChart
        summary={tr("Kilograms moved per week, last 8 weeks")}
        format="int"
        unit="kg"
        data={vm.weekly.map((w, i) => ({ label: formatDay(w.week, DAY.monthDay), title: tr("Week of {0} · {1} sessions", [formatDay(w.week, DAY.monthDay), w.sessions]), value: w.tonnage || null, highlight: i === vm.weekly.length - 1 }))}
        tickEvery={2}
      />
    </SectionShell>
  )
}

function Sessions({ vm }: { vm: StrengthVM }) {
  if (!vm.sessions.length) return <EmptyState body={tr("No sessions yet. Log your first one and Pulse starts counting sets per muscle and PRs.")} />
  return (
    <SectionShell variant="section" title={tr("Sessions")}>
      <ul className="flex flex-col gap-3">
        {vm.sessions.slice(0, 12).map((s) => (
          <li key={s.id} className={cn(CARD_MATERIAL, "p-4")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={LABEL}>{formatDay(s.day, DAY.short)}</p>
                <p className={cn(CAPTION, "mt-1")}>
                  {s.sets} {" "}{tr("sets ·")}{" "}{s.tonnage.toLocaleString(LOCALE)} kg{s.durationMin ? ` · ${s.durationMin} min` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ValueUnit value={formatValue("decimal1", s.load)} unit="load" className="font-numeric text-xl font-bold text-strain-text" />
                <DeleteEntry kind="strength" id={s.id} label={tr("session on {0}", [formatDay(s.day, DAY.long)])} />
              </div>
            </div>
            {s.prs.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {s.prs.map((p) => (
                  <StatusChip key={p.key} tone="optimal">
                    <Trophy aria-hidden strokeWidth={2} className="size-3.5" /> PR {p.label}: {p.set.kg} {" "}{tr("kg ×")}{" "}{p.set.reps}
                  </StatusChip>
                ))}
              </div>
            )}
            <ul className="mt-3 divide-y divide-border">
              {s.exercises.map((x, i) => (
                <li key={`${x.key}-${i}`} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-[15px] leading-5">{x.label}</span>
                  <span className={cn(CAPTION, "tabular-nums")}>
                    {x.sets.length} {" "}{tr("× · top")}{" "}{x.best}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}

/** Strength `/strength`: today's muscular load, weekly sets per muscle, volume and every session with its PRs. */
export default async function StrengthPage() {
  await connection()
  const vm = await getStrength(await userCtx())
  return (
    <DetailShell
      title={tr("Strength")}
      info={INFO}
      action={<Tag kind="beta" />}
      hero={<Hero vm={vm} />}
      summary={<LogButton />}
      primary={<MuscleVolume vm={vm} />}
      secondary={[<Weekly key="w" vm={vm} />, <Sessions key="s" vm={vm} />]}
    />
  )
}
