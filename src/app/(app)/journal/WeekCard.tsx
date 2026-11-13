import { LOCALE } from "@/lib/format"
import { formatDay } from "@/lib/format"
import type { WeekDay } from "@/server/queries/log"
import { ColumnChart } from "@/components/charts/ColumnChart"
import { CAPTION, LABEL } from "@/components/metrics/primitives"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { t as tr } from "@/lib/i18n"

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null)
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
}

/** Journal's week beside the log: water and food for the seven days ending on the selected day, that day highlighted. */
export function WeekCard({ week, day }: { week: WeekDay[]; day: string }) {
  const rows = [
    { key: "water" as const, title: tr("Water"), unit: "ml" },
    { key: "kcal" as const, title: tr("Food"), unit: "kcal" },
  ]
  return (
    <Card className="gap-4 px-4 py-4 xl:px-5">
      {rows.map((r) => {
        const a = avg(week.map((w) => w[r.key]))
        return (
          <section key={r.key} aria-label={tr("{0}, last 7 days", [r.title])} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className={LABEL}>{r.title}</h3>
              <span className={cn(CAPTION, "tabular-nums")}>{a === null ? "No data" : `avg ${a.toLocaleString(LOCALE)} ${r.unit}`}</span>
            </div>
            <ColumnChart
              summary={tr("{0} per day for the 7 days to {1}", [r.title, formatDay(day, { month: "short", day: "numeric" })])}
              format="grouped"
              unit={r.unit}
              data={week.map((w) => ({ label: formatDay(w.day, { weekday: "short" }), title: formatDay(w.day, { weekday: "short", month: "short", day: "numeric" }), value: w[r.key], highlight: w.day === day }))}
            />
          </section>
        )
      })}
    </Card>
  )
}
