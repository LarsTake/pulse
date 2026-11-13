import { clock, DAY, durationWords, formatDay, formatValue, hmm, type TimeFormat } from "@/lib/format"
import { activityHref } from "@/lib/url"
import type { Metric } from "@/lib/reasons"
import { ColumnChart } from "@/components/charts/ColumnChart"
import { KeyStatRow } from "@/components/metrics/KeyStatRow"
import { EmptyState } from "@/components/shells/EmptyState"
import { MetricState } from "@/components/shells/MetricState"
import { SectionShell } from "@/components/shells/SectionShell"
import type { MetricDetailVM, Section } from "@/server/queries/metric"
import { CAPTION, LABEL, LEGEND, statProps } from "../../_lib/view"
import { t as tr } from "@/lib/i18n"

export const METRIC_GRID = "grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start xl:gap-4"

type Ctx = { vm: MetricDetailVM; timeZone: string; timeFormat: TimeFormat; className?: string }

const at = (ms: number, c: Ctx) => clock(ms, c.timeZone, c.timeFormat)

const ok = (v: number): Metric<number> => ({ value: v, reason: null, provisional: false })
const rows = (children: React.ReactNode) => <div className="divide-y divide-border">{children}</div>

export function MetricSection({ s, ...c }: Ctx & { s: Section }) {
  switch (s.kind) {
    case "hourly":
      return <Hourly s={s} {...c} />
    case "goal":
      return (
        <SectionShell variant="card" level={2} title={tr("{0}-step days", [formatValue("grouped", s.target)])} info={{ title: tr("Days reaching the step reference"), body: tr("Recorded days that reached the displayed step reference. Missing data does not count as a completed day.") }} className={c.className}>
          {rows(
            <>
              <KeyStatRow variant="row" label={tr("Current streak")} metric={ok(s.streak)} unit={s.streak === 1 ? "day" : "days"} format="int" direction="none" />
              <KeyStatRow variant="row" label={tr("Longest streak")} caption={tr("In the past year")} metric={ok(s.longest)} unit={s.longest === 1 ? "day" : "days"} format="int" direction="none" />
              <KeyStatRow variant="row" label={tr("Days reached")} caption={tr("In the last {0} days", [s.days])} metric={ok(s.met)} unit={`of ${s.days}`} format="int" direction="none" />
            </>,
          )}
          <p className={LEGEND}>{tr("About 7,000 steps a day goes with markedly lower health risks in a 2025 review of 57 studies. It is a reference, not a goal you set.")}</p>
        </SectionShell>
      )
    case "weekday": {
      const best = Math.max(...s.days.map((d) => d.value ?? -Infinity))
      return (
        <SectionShell variant="card" level={2} title={tr("By weekday")} className={c.className}>
          <ColumnChart
            summary={tr("Average {0} by weekday over the last {1} weeks: {2}.", [c.vm.label, s.weeks, s.days.map((d) => `${d.label} ${formatValue(c.vm.format, d.value)}`).join(", ")])}
            data={s.days.map((d) => ({ label: d.label, value: d.value, highlight: d.value === best }))}
            format={c.vm.format}
            unit={c.vm.unit}
          />
          <p className={`${CAPTION} mt-2`}>{tr("Daily average for each weekday over the last")}{" "}{s.weeks} weeks.</p>
        </SectionShell>
      )
    }
    case "weekly":
      return <Weekly s={s} {...c} />
    case "intensity":
      return (
        <SectionShell variant="card" level={2} title={tr("Minutes by intensity")} className={c.className}>
          {rows(s.rows.map((k) => <KeyStatRow key={k.key} variant="row" {...statProps(k)} />))}
          <p className={LEGEND}>{tr("This day vs. its prior 30 days")}</p>
        </SectionShell>
      )
    case "workouts": {
      const burned = s.items.reduce((a, w) => a + (w.calories ?? 0), 0)
      return (
        <SectionShell variant="card" level={2} title={tr("Workouts")} className={c.className}>
          {s.items.length ? (
            <>
              {rows(
                s.items.map((w) => (
                  <KeyStatRow
                    key={w.id}
                    variant="row"
                    label={w.name}
                    caption={`${at(w.start, c)} - ${at(w.end, c)}`}
                    metric={w.calories === null ? { value: null, reason: "no_data", provisional: false } : ok(w.calories)}
                    unit="kcal"
                    format="grouped"
                    direction="none"
                    href={activityHref(w.id)}
                  />
                )),
              )}
              {s.active !== null && burned > 0 && (
                <p className={LEGEND}>
                  {tr("Workouts burned")}{" "}{formatValue("grouped", burned)} {" "}{tr("of the day’s")}{" "}{formatValue("grouped", s.active)} {" "}{tr("active kcal.")}</p>
              )}
            </>
          ) : (
            <EmptyState body={tr("No workouts recorded on this day.")} className="py-4" />
          )}
        </SectionShell>
      )
    }
    case "entries":
      return (
        <SectionShell variant="card" level={2} title={tr("Logged entries")} className={c.className}>
          {s.items.length ? (
            <ul className="divide-y divide-border">
              {s.items.map((e) => (
                <li key={e.id} className="flex min-h-13 items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className={`${LABEL} block truncate`}>{e.title}</span>
                    <span className={`${CAPTION} mt-0.5 block truncate`}>{e.detail}</span>
                  </span>
                  <span className="shrink-0 font-numeric text-[13px] leading-4 font-medium text-muted-foreground tabular-nums">{at(e.ts * 1000, c)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState body={tr("Nothing logged in Pulse on this day. Entries made in other apps count in the total once they sync.")} className="py-4" />
          )}
        </SectionShell>
      )
    case "balance":
      return (
        <SectionShell variant="card" level={2} title={tr("Eaten vs. burned")} className={c.className}>
          {rows(s.rows.map((k) => <KeyStatRow key={k.key} variant="row" {...statProps(k, undefined, false)} />))}
        </SectionShell>
      )
    case "macros":
      return (
        <SectionShell variant="card" level={2} title={tr("Macros")} className={c.className}>
          {rows(s.rows.map((k) => <KeyStatRow key={k.key} variant="row" {...statProps(k, undefined, false)} />))}
        </SectionShell>
      )
    case "readings":
      return (
        <SectionShell variant="card" level={2} title={tr("Readings")} className={c.className}>
          {rows(
            <>
              {s.changes.map((k) => (
                <KeyStatRow key={k.key} variant="row" {...statProps(k, undefined, false)} />
              ))}
              {s.items.map((r) => (
                <KeyStatRow key={r.day} variant="row" label={formatDay(r.day, DAY.short)} metric={ok(r.value)} unit={c.vm.unit} format={c.vm.format} direction="none" />
              ))}
            </>,
          )}
        </SectionShell>
      )
    case "outliers": {
      const range = `${formatValue(c.vm.format, s.mean - s.sd)} - ${formatValue(c.vm.format, s.mean + s.sd)}${c.vm.unit ? ` ${c.vm.unit}` : ""}`
      return (
        <SectionShell variant="card" level={2} title={tr("Unusual days")} className={c.className}>
          <p className={`${CAPTION} mb-2`}>{tr("Your usual range over the last 90 days is")}{" "}{range}{tr(". Days far outside it are listed here.")}</p>
          {s.items.length ? (
            rows(
              s.items.map((o) => (
                <KeyStatRow
                  key={o.day}
                  variant="row"
                  label={formatDay(o.day, DAY.short)}
                  caption={o.dir === "high" ? "Above your usual range" : "Below your usual range"}
                  metric={ok(o.value)}
                  unit={c.vm.unit}
                  format={c.vm.format}
                  direction="none"
                />
              )),
            )
          ) : (
            <EmptyState body={tr("No unusual days in the last 90 days.")} className="py-4" />
          )}
        </SectionShell>
      )
    }
  }
}

function Hourly({ s, vm, timeZone, timeFormat, className }: Ctx & { s: Extract<Section, { kind: "hourly" }> }) {
  const sedentary = vm.key === "sedentary_minutes"
  return (
    <SectionShell variant="card" level={2} title={sedentary ? "Movement by hour" : "Steps by hour"} className={className}>
      <MetricState
        metric={s.hours}
        skeleton={<ColumnChart.Skeleton />}
        renderReason={() => <EmptyState body={tr("No per-minute steps for this day.")} className="py-10" />}
      >
        {(hours) => {
          const done = hours.filter((h) => h.value !== null)
          const peak = done.reduce((a, h) => ((h.value ?? 0) > (a?.value ?? 0) ? h : a), done[0])
          return (
            <>
              <ColumnChart
                summary={tr("Steps by hour{0}.", [peak?.value ? `, most at ${peak.label} with ${formatValue("grouped", peak.value)}` : ""])}
                data={hours.map((h, i) => ({ label: h.label, title: `${h.label} - ${hours[i + 1]?.label ?? clock(h.t + 3_600_000, timeZone, timeFormat)}`, value: h.value }))}
                format="grouped"
                unit="steps"
                tickEvery={6}
              />
              {sedentary && s.still && (
                <p className={LEGEND}>
                  {tr("Longest daytime stretch without steps:")}{" "}{durationWords(s.still.minutes)}, {clock(s.still.from, timeZone, timeFormat)} - {clock(s.still.to, timeZone, timeFormat)}
                </p>
              )}
            </>
          )
        }}
      </MetricState>
    </SectionShell>
  )
}

function Weekly({ s, vm, className }: Ctx & { s: Extract<Section, { kind: "weekly" }> }) {
  const pct = Math.min(100, (s.week.total / s.target) * 100)
  return (
    <SectionShell variant="card" level={2} title={tr("This week")} className={className}>
      <p className="font-numeric text-[28px] leading-8 font-bold tabular-nums">
        {hmm(s.week.total)}
        <span className="ml-1 text-sm leading-5 font-medium text-foreground-secondary">of {hmm(s.target)}</span>
      </p>
      <div
        role="meter"
        aria-label={tr("{0} this week", [vm.label])}
        aria-valuemin={0}
        aria-valuemax={s.target}
        aria-valuenow={Math.round(s.week.total)}
        className="mt-2 mb-1 h-2 overflow-hidden rounded-full bg-dial-track"
      >
        <div className="h-full rounded-full bg-optimal" style={{ width: `${pct}%` }} />
      </div>
      <p className={`${CAPTION} mb-4`}>
        {formatDay(s.week.from, DAY.monthDay)} - {formatDay(s.week.to, DAY.monthDay)}{tr(", toward the")}{" "}{s.target} {" "}{tr("minutes a week the WHO recommends")}</p>
      <ColumnChart
        summary={tr("{0} per week, last {1} weeks. Target met in {2}.", [vm.label, s.weeks.length, s.met])}
        data={s.weeks.map((w) => ({ label: formatDay(w.from, DAY.monthDay), title: tr("Week of {0}", [formatDay(w.from, DAY.monthDay)]), value: w.value, highlight: (w.value ?? 0) >= s.target }))}
        format="duration"
        tickEvery={3}
        reference={{ y: s.target, label: hmm(s.target) }}
      />
      <p className={`${CAPTION} mt-2`}>
        {tr("Target met in")}{" "}{s.met} {" "}{tr("of the last")}{" "}{s.weeks.length} weeks
      </p>
    </SectionShell>
  )
}
