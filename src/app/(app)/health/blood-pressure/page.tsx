import { connection } from "next/server"
import { cn } from "@/lib/utils"
import { clock, DAY, formatDay } from "@/lib/format"
import { BP_CATEGORY_LABEL } from "@/core/algorithms/bloodPressure"
import { userCtx } from "@/server/queries/common"
import { getBloodPressure } from "@/server/queries/bodyLogs"
import { BpChart } from "@/components/charts/BpChart"
import { CAPTION, LABEL, StatusChip, Tag } from "@/components/metrics/primitives"
import { DetailShell } from "@/components/shells/DetailShell"
import { EmptyState } from "@/components/shells/EmptyState"
import { SectionShell } from "@/components/shells/SectionShell"
import { SheetTrigger } from "@/components/shells/SheetTrigger"
import { DeleteEntry } from "../../_lib/DeleteEntry"
import { BP_TONE } from "../format"

export const metadata = { title: "Blood Pressure" }


const INFO = {
  title: "About Blood Pressure",
  body: (
    <>
      <p>Readings you type in from an upper-arm cuff. Pulse averages them by week and month and classes each against the 2017 ACC/AHA guideline.</p>
      <p>
        Normal is under 120 / 80. Elevated: systolic 120 to 129. High stage 1: 130 to 139 or 80 to 89. High stage 2: 140 / 90 or more. Over 180 / 120,
        sit for five minutes and measure again; if it stays there, get care.
      </p>
      <p>Not a diagnosis. Your doctor decides what your numbers mean for you.</p>
    </>
  ),
}

const BIG = "font-numeric text-[64px] leading-none font-bold tracking-[-0.01em] tabular-nums md:text-[72px]"

function LogButton() {
  return (
    <SheetTrigger
      sheet="bp"
      className="inline-flex h-14 w-full items-center justify-center rounded-full bg-primary px-6 text-[15px] font-bold tracking-[0.1em] text-primary-foreground uppercase outline-none hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      Log reading
    </SheetTrigger>
  )
}

export default async function BloodPressurePage() {
  await connection()
  const ctx = await userCtx()
  const vm = await getBloodPressure(ctx)
  const head = vm.week ?? (vm.latest ? { systolic: vm.latest.systolic, diastolic: vm.latest.diastolic, category: vm.latest.category, count: 1, pulse: vm.latest.pulse } : null)
  const time = (ts: number) => clock(ts * 1000, ctx.timeZone, ctx.profile.timeFormat)

  return (
    <DetailShell
      title="Blood Pressure"
      info={INFO}
      backHref="/health"
      action={<Tag kind="beta" />}
      hero={
        head ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className={BIG}>
              {head.systolic}
              <span className="text-muted-foreground">/</span>
              {head.diastolic}
            </p>
            <p className="flex items-center gap-3">
              <span className={LABEL}>{vm.week ? "7-day average" : "Latest"} · mmHg</span>
            </p>
            <StatusChip tone={BP_TONE[head.category]}>{BP_CATEGORY_LABEL[head.category]}</StatusChip>
            {vm.weekDelta && (
              <p className={CAPTION}>
                {vm.weekDelta.systolic >= 0 ? "+" : "−"}
                {Math.abs(vm.weekDelta.systolic)} / {vm.weekDelta.diastolic >= 0 ? "+" : "−"}
                {Math.abs(vm.weekDelta.diastolic)} vs. the week before
              </p>
            )}
          </div>
        ) : (
          <EmptyState body="No readings yet. Log one from your cuff; a week of morning and evening readings gives a fair average." />
        )
      }
      summary={<LogButton />}
      primary={
        vm.daily.length > 1 ? (
          <SectionShell variant="card" title="Last 90 days">
            <BpChart data={vm.daily} />
            <p className={cn(CAPTION, "mt-3")}>Red: systolic. Blue: diastolic. Shaded: under 120.</p>
          </SectionShell>
        ) : null
      }
      secondary={[
        vm.month && (
          <SectionShell key="m" variant="card" title="30-day average">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-numeric text-3xl font-bold tabular-nums">
                {vm.month.systolic}/{vm.month.diastolic}
                <span className="ml-1 text-sm font-medium text-muted-foreground">mmHg</span>
              </p>
              <StatusChip tone={BP_TONE[vm.month.category]}>{BP_CATEGORY_LABEL[vm.month.category]}</StatusChip>
            </div>
            <p className={cn(CAPTION, "mt-2")}>
              {vm.month.count} readings{vm.month.pulse ? ` · pulse ${vm.month.pulse} bpm` : ""}
            </p>
          </SectionShell>
        ),
        vm.readings.length > 0 && (
          <SectionShell key="r" variant="section" title="Recent readings">
            <ul className="divide-y divide-border">
              {vm.readings.slice(0, 20).map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-numeric text-lg font-bold tabular-nums">
                      {r.systolic}/{r.diastolic}
                      {r.pulse !== null && <span className="ml-2 text-sm font-medium text-muted-foreground">♥ {r.pulse}</span>}
                    </p>
                    <p className={CAPTION}>
                      {formatDay(r.day, DAY.short)} · {time(r.ts)}
                    </p>
                  </div>
                  <StatusChip tone={BP_TONE[r.category]}>{BP_CATEGORY_LABEL[r.category]}</StatusChip>
                  <DeleteEntry kind="bp" id={r.id} label={`reading ${r.systolic} over ${r.diastolic}`} />
                </li>
              ))}
            </ul>
          </SectionShell>
        ),
      ].filter(Boolean) as React.ReactNode[]}
    />
  )
}
