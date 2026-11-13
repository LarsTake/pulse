import { Archive, BookOpen, CalendarDays, CalendarRange, ChartLine, Database, ListChecks, Palette, Plug, UserRound } from "lucide-react"
import { SCORING_VERSION } from "@/server/pipeline"
import { APP_VERSION } from "@/server/queries/settings"
import { LinkListSkeleton, MORE_COLUMN } from "@/components/shells/LinkList"
import { PageShell } from "@/components/shells/PageShell"
import { About } from "./About"
import { t as tr } from "@/lib/i18n"

/** More: the same rows and About card in their final boxes; only the captions are bars (spec §5.19). */
export default function Loading() {
  return (
    <PageShell loading title={tr("More")}>
      <div className={MORE_COLUMN}>
        <div className="xl:hidden">
          <LinkListSkeleton
            title={tr("Account & settings")}
            rows={[
              { icon: UserRound, label: tr("Account") },
              { icon: Plug, label: tr("Data source") },
              { icon: Palette, label: tr("App") },
            ]}
          />
        </div>
        <LinkListSkeleton
          title={tr("Reports")}
          rows={[
            { icon: CalendarRange, label: tr("Weekly report") },
            { icon: CalendarDays, label: tr("Monthly report") },
            { icon: Archive, label: tr("All reports") },
          ]}
        />
        <LinkListSkeleton title={tr("Trends")} rows={[{ icon: ChartLine, label: tr("Trends") }]} />
        <LinkListSkeleton title={tr("Journal")} rows={[{ icon: ListChecks, label: tr("Behaviours") }]} />
        <LinkListSkeleton title={tr("Help")} rows={[{ icon: BookOpen, label: tr("How Pulse works") }]} />
        <LinkListSkeleton title={tr("Your data")} rows={[{ icon: Database, label: tr("Export") }]} />
        <div aria-hidden className="contents">
          <About version={APP_VERSION} scoringVersion={SCORING_VERSION} />
        </div>
      </div>
    </PageShell>
  )
}
