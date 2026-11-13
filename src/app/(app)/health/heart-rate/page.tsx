import { dayLabel } from "@/lib/format"
import { getHeartRate } from "@/server/queries/health"
import { ZoneBars } from "@/components/charts/ZoneBars"
import { DetailShell } from "@/components/shells/DetailShell"
import { SectionShell } from "@/components/shells/SectionShell"
import { pageDay, type SearchParams } from "../../_lib/day"
import { HeartRateChart, HeartRateHero, LiveHeartRate } from "./LiveHeartRate"
import { t as tr } from "@/lib/i18n"

export const metadata = { title: tr("Heart rate"), description: tr("Your latest heart rate, today’s minute-by-minute chart and time in heart-rate zones.") }

const INFO = {
  title: tr("About heart rate"),
  body: (
    <>
      <p>{tr("Your band records heart rate through the day. Fitbit uploads it to Google Health, and Pulse reads it from there.")}</p>
      <p>{tr("While this screen is open on today, Pulse checks for new readings every minute. A reading usually arrives one to three minutes after your band takes it, so the newest one is never quite now.")}</p>
      <p>{tr("The chart shows each minute’s average. Minutes without a reading, when the band was off or not syncing, stay blank.")}</p>
    </>
  ),
}

export default async function HeartRatePage({ searchParams }: PageProps<"/health/heart-rate">) {
  const { d, today, ctx } = await pageDay(searchParams as SearchParams, "/health/heart-rate")
  const vm = await getHeartRate(d, ctx)
  return (
    // Remount on date changes because the live view seeds its state only once.
    <LiveHeartRate key={d} vm={vm}>
      <DetailShell
        title={tr("Heart rate")}
        dateSwitcher={{ mode: "day" }}
        info={INFO}
        hero={<HeartRateHero />}
        primary={
          <SectionShell variant="card" level={2} title={vm.isToday ? tr("Today") : dayLabel(d, today)} info={{ title: tr("Daily heart rate"), body: tr("Heartbeats per minute across the selected day. Gaps mean no heart rate reading was available.") }}>
            <HeartRateChart />
          </SectionShell>
        }
        secondary={[
          <SectionShell key="zones" variant="card" level={2} title={tr("Time in zones")} className="xl:col-span-2">
            <ZoneBars variant="rows" data={vm.zones} note={vm.zoneNote} emptyCopy={vm.isToday ? "No heart-rate zones yet today." : "No heart-rate zones on this day."} />
          </SectionShell>,
        ]}
      />
    </LiveHeartRate>
  )
}
