"use client"

import { CartesianGrid, ComposedChart, Line, ReferenceArea, XAxis, YAxis } from "recharts"
import { DAY, formatDay } from "@/lib/format"
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { AXIS, ChartFigure, GRID, LINE_CURSOR, TOOLTIP_CLASS, TooltipLine, useSeriesAnimation } from "./ChartFrame"

const SYS = "var(--recovery-red)"
const DIA = "var(--strain)"

/** Blood pressure, daily means: systolic and diastolic lines over the normal zone (below 120 / 80). */
export function BpChart({ data }: { data: { day: string; systolic: number; diastolic: number }[] }) {
  const anim = useSeriesAnimation()
  // Round to 20 mmHg so the ticks land on 60, 80, 100, 120…
  const lo = Math.floor((Math.min(60, ...data.map((d) => d.diastolic)) - 5) / 20) * 20
  const hi = Math.ceil((Math.max(140, ...data.map((d) => d.systolic)) + 5) / 20) * 20
  const ticks = Array.from({ length: (hi - lo) / 20 + 1 }, (_, i) => lo + i * 20)
  return (
    <ChartFigure
      summary={`Blood pressure, ${data.length} days with readings`}
      config={{ systolic: { label: "Systolic", color: SYS }, diastolic: { label: "Diastolic", color: DIA } }}
      className="h-52"
    >
      <ComposedChart data={data} accessibilityLayer margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid {...GRID} />
        {/* Normal: systolic under 120 and diastolic under 80; shaded so a reading reads at a glance. */}
        <ReferenceArea y1={lo} y2={120} fill="var(--optimal)" fillOpacity={0.06} ifOverflow="hidden" />
        <XAxis dataKey="day" {...AXIS} minTickGap={24} tickFormatter={(d: string) => formatDay(d, DAY.monthDay)} />
        <YAxis {...AXIS} width={32} domain={[lo, hi]} ticks={ticks} allowDecimals={false} />
        <ChartTooltip
          isAnimationActive={false}
          cursor={LINE_CURSOR}
          content={
            <ChartTooltipContent
              className={TOOLTIP_CLASS}
              hideIndicator
              labelFormatter={(_, p) => (p?.[0]?.payload ? formatDay((p[0].payload as { day: string }).day, DAY.short) : "")}
              formatter={(v, name) => (
                <TooltipLine color={name === "systolic" ? SYS : DIA}>
                  {name === "systolic" ? "Systolic" : "Diastolic"} {String(v)} mmHg
                </TooltipLine>
              )}
            />
          }
        />
        <Line type="monotone" dataKey="systolic" stroke={SYS} strokeWidth={2} dot={{ r: 2.5, fill: SYS, strokeWidth: 0 }} {...anim} />
        <Line type="monotone" dataKey="diastolic" stroke={DIA} strokeWidth={2} dot={{ r: 2.5, fill: DIA, strokeWidth: 0 }} {...anim} />
      </ComposedChart>
    </ChartFigure>
  )
}
