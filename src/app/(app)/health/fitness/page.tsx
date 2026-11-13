import { connection } from "next/server"
import { cn } from "@/lib/utils"
import { DAY, formatDay, formatValue } from "@/lib/format"
import { userCtx } from "@/server/queries/common"
import { getFitness } from "@/server/queries/health"
import type { FitnessVM } from "@/server/queries/types"
import { TrendChart } from "@/components/charts/TrendChart"
import { CAPTION, LABEL, MetricTags, StatusChip, ValueUnit } from "@/components/metrics/primitives"
import { ReasonPlaceholder } from "@/components/metrics/ReasonPlaceholder"
import { TickScale } from "@/components/metrics/TickScale"
import { DetailShell } from "@/components/shells/DetailShell"
import { EmptyState } from "@/components/shells/EmptyState"
import { SectionShell } from "@/components/shells/SectionShell"
import { categoryTone, categoryWord, ordinal } from "../format"
import { LoadChart } from "./LoadChart"
import { t as tr } from "@/lib/i18n"

export const metadata = { title: tr("Fitness") }

const BODY = "text-[15px] leading-[22px] text-pretty text-foreground-secondary"
// Both thresholds follow the pipeline: ACWR shows after 14 days of strain (readiness `minChronic`), fitness and fatigue
// after 14 days in a row (training load `minimumDays`).
const NO_LOAD = "Training load needs 14 days of strain."
const NO_FFS = "Fitness, fatigue and form need 14 days of strain in a row."

const INFO = {
  title: tr("About Fitness"),
  body: (
    <p>
      {tr("VO2 max is the most oxygen your body can use during hard exercise. Pulse ranks it against people of your age and sex from the FRIEND registry. Training load compares your last 7 days of strain with your last 28 (the acute to chronic ratio); 0.8 to 1.3 is the usual sweet spot.")}</p>
  ),
}

const STATUS: Record<NonNullable<FitnessVM["trainingLoad"]["value"]>["status"], { word: string; body: string }> = {
  detraining: { word: tr("Detraining"), body: tr("Detraining: your recent load is well below your usual. Fitness slowly drops if this lasts.") },
  optimal: { word: tr("Optimal"), body: tr("Optimal: your recent load matches what you are used to.") },
  pushing: { word: tr("Pushing"), body: tr("Pushing: load is rising faster than usual. Watch your Recovery.") },
  high_risk: { word: tr("High risk"), body: tr("High risk: load jumped well above your usual. Injury and illness risk rise.") },
}
const CATEGORIES = [tr("Poor"), tr("Fair"), tr("Good"), tr("Excellent"), tr("Superior")]

function Hero({ vo2 }: { vo2: FitnessVM["vo2"] }) {
  const v = vo2.value
  if (!v) return <EmptyState body={tr("No VO2 max yet. Fitbit estimates it from runs and resting heart rate.")} />
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <ValueUnit value={formatValue("decimal1", v.value)} unit="ml/kg/min" className="font-numeric text-[64px] leading-none font-bold tracking-[-0.01em] md:text-[72px]" />
      <p className="flex items-center gap-3">
        <span className={LABEL}>{tr("VO2 max")}</span>
        <span className={cn(LABEL, categoryTone(v.category))}>{categoryWord(v.category)}</span>
      </p>
      <p className={CAPTION}>{v.source === "run" ? tr("From a run on {0}", [formatDay(v.sourceDay, DAY.monthDay)]) : "Daily estimate from Fitbit"}</p>
      {vo2.provisional && <MetricTags extra={["estimate"]} />}
    </div>
  )
}

/** Fitness `/health/fitness` (spec §7.10): latest values, no date switcher. */
export default async function FitnessPage() {
  await connection()
  const vm = await getFitness(await userCtx())
  const v = vm.vo2.value
  const tl = vm.trainingLoad.value

  return (
    <DetailShell
      title={tr("Fitness")}
      info={INFO}
      hero={<Hero vo2={vm.vo2} />}
      summary={
        v && (
          <SectionShell variant="card" title={tr("Percentile")}>
            <TickScale
              variant="marker"
              label={tr("VO2 max percentile")}
              metric={{ value: v.percentile, reason: null, provisional: false }}
              min={0}
              max={100}
              format="int"
              describe={tr("{0} for {1} {2}", [categoryWord(v.category), v.sex === "male" ? tr("men") : tr("women"), v.ageBand])}
              bands={[
                { from: 0, to: 39.9, tone: "warning" },
                { from: 60, to: 100, tone: "optimal" },
              ]}
              ends={["0", "50", "100"]}
            />
            <div aria-hidden className={cn(CAPTION, "mt-2 grid grid-cols-5 text-center")}>
              {CATEGORIES.map((c) => (
                <span key={c} className={cn("truncate", c === categoryWord(v.category) && "font-bold text-foreground")}>
                  {c}
                </span>
              ))}
            </div>
            <p className={cn(CAPTION, "mt-3")}>
              {ordinal(v.percentile)} {" "}{tr("percentile for")}{" "}{v.sex === "male" ? "men" : "women"} {v.ageBand} {" "}{tr("(FRIEND registry).")}</p>
          </SectionShell>
        )
      }
      primary={
        <SectionShell variant="card" title={tr("VO2 max trend")}>
          <TrendChart
            label={tr("VO2 max")}
            data={{ value: vm.trend.points.map((p) => ({ date: p.day, value: p.value })), reason: null, provisional: false }}
            unit="ml/kg/min"
            format="decimal1"
            colorBy="single"
            direction="up"
            defaultRange="6m"
          />
        </SectionShell>
      }
      secondary={[
        <SectionShell key="load" variant="card" title={tr("Training load")}>
          {tl ? (
            <div className="space-y-4">
              <p className="flex items-center gap-3">
                <span className="font-numeric text-4xl leading-10 font-bold tracking-[-0.01em] tabular-nums">{formatValue("decimal2", tl.acwr)}</span>
                <StatusChip tone={tl.tone}>{STATUS[tl.status].word}</StatusChip>
              </p>
              <TickScale
                variant="marker"
                label={tr("Training load")}
                metric={vm.trainingLoad.value ? { value: tl.acwr, reason: null, provisional: false } : null}
                min={0.5}
                max={2}
                format="decimal2"
                bands={[
                  { from: 0.8, to: 1.3, tone: "optimal" },
                  { from: 1.5, to: 2, tone: "warning" },
                ]}
                ends={["0.5", "1.0", "1.5", "2.0"]}
              />
              <p className={BODY}>{STATUS[tl.status].body}</p>
            </div>
          ) : (
            <ReasonPlaceholder reason="calibrating" size="md" copy={NO_LOAD} />
          )}
        </SectionShell>,
        <SectionShell key="ffs" variant="card" title={tr("Fitness, fatigue and form")}>
          {vm.loadReason ? (
            <ReasonPlaceholder reason={vm.loadReason.reason} size="md" copy={NO_FFS} />
          ) : (
            <>
              <LoadChart load={vm.load} />
              <p className={cn(CAPTION, "mt-2")}>{tr("Fitness is your 42-day load, fatigue your 7-day load, form the difference.")}</p>
            </>
          )}
        </SectionShell>,
      ]}
    />
  )
}
