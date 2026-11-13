import { FEATURES } from "@/lib/features"
import { connection } from "next/server"
import { Archive, BookOpen, BotMessageSquare, CalendarDays, CalendarRange, ChartLine, Database, Dumbbell, FlaskConical, HeartPulse, ListChecks, Palette, Plug, Stethoscope, UserRound } from "lucide-react"
import { formatDay, rangeLabel } from "@/lib/format"
import { coachAccess } from "@/server/coach/store"
import { userCtx } from "@/server/queries/common"
import { getMore } from "@/server/queries/settings"
import { LinkList, MORE_COLUMN, type LinkListRow } from "@/components/shells/LinkList"
import { PageShell } from "@/components/shells/PageShell"
import { About } from "./About"
import { SCORE_DOCS } from "./how-it-works/content"
import { t as tr } from "@/lib/i18n"

export const metadata = { title: tr("More") }

/** More `/more` (spec §7.14, U21): everything that isn't configuration. Settings stays Account, Data source, Profile. */
export default async function MorePage() {
  await connection()
  const ctx = await userCtx()
  const [vm, coach] = await Promise.all([getMore(ctx), coachAccess(ctx.db, ctx.userId)])
  // Below 1280 px (where the sidebar lists Settings) each part of Settings is a row here, as the reference app's "Account & settings".
  const settings: LinkListRow[] = [
    { icon: UserRound, label: tr("Account"), href: "/settings?s=account" },
    { icon: Plug, label: tr("Data source"), href: "/settings?s=source" },
    { icon: Palette, label: tr("App"), href: "/settings?s=app" },
    ...(coach ? [{ icon: BotMessageSquare, label: tr("Coach"), href: "/settings?s=coach" }] : []),
  ]
  const reports: LinkListRow[] = [
    ...(vm.latestWeek
      ? [{ icon: CalendarRange, label: tr("Weekly report"), aside: rangeLabel(vm.latestWeek.start, vm.latestWeek.end), href: `/reports/${vm.latestWeek.period}` }]
      : []),
    ...(vm.latestMonth
      ? [{ icon: CalendarDays, label: tr("Monthly report"), aside: formatDay(vm.latestMonth.start, { month: "long" }), href: `/reports/${vm.latestMonth.period}` }]
      : []),
    { icon: Archive, label: tr("All reports"), aside: vm.reportCount ? String(vm.reportCount) : undefined, href: "/reports" },
  ]

  return (
    <PageShell title={tr("More")}>
      {/* One 640 px column, as Settings: a list reads top to bottom, and side-by-side columns sharing grid rows
          left holes whenever one section was shorter (no reports yet). */}
      <div className={MORE_COLUMN}>
        <LinkList title={tr("Account & settings")} rows={settings} className="xl:hidden" />
        <LinkList title={tr("Reports")} rows={reports} />
        <LinkList title={tr("Trends")} rows={[{ icon: ChartLine, label: tr("Trends"), aside: tr("Up to 1 year"), href: "/trends" }]} />
        <LinkList
          title={tr("Body")}
          rows={[
            ...(FEATURES.strengthTrainer ? [{ icon: Dumbbell, label: tr("Strength"), href: "/strength" }] : []),
            ...(FEATURES.bloodPressure ? [{ icon: Stethoscope, label: tr("Blood pressure"), href: "/health/blood-pressure" }] : []),
            ...(FEATURES.labs ? [{ icon: FlaskConical, label: tr("Labs"), href: "/health/labs" }] : []),
            ...(FEATURES.liveHeartRate ? [{ icon: HeartPulse, label: tr("Live heart rate"), aside: tr("Chrome, Edge"), href: "/live" }] : []),
          ]}
        />
        <LinkList
          title={tr("Journal")}
          rows={[{ icon: ListChecks, label: tr("Behaviours"), aside: tr("{0} of {1} shown", [vm.behaviours.shown, vm.behaviours.total]), href: "/more/behaviours" }]}
        />
        <LinkList title={tr("Help")} rows={[{ icon: BookOpen, label: tr("How Pulse works"), aside: tr("{0} scores", [SCORE_DOCS.length]), href: "/more/how-it-works" }]} />
        <LinkList title={tr("Your data")} rows={[{ icon: Database, label: tr("Export"), aside: tr("CSV, JSON"), href: "/more/data" }]} />
        <About version={vm.version} scoringVersion={vm.scoringVersion} />
      </div>
    </PageShell>
  )
}
