import { signupMode } from "@/server/admin"
import { coachMode } from "@/server/coach/store"
import { ModeChoice } from "../AdminClient"
import { adminGate } from "../gate"
import { PageHeader, Panel } from "../ui"
import { t as tr } from "@/lib/i18n"

export const metadata = { title: tr("Access") }

/** Admin › Access `/admin/access`: who can sign up, and who can use the AI coach. Saved on pick, no restart. */
export default async function AccessPage() {
  const { db } = await adminGate()
  const [signup, coach] = await Promise.all([signupMode(db), coachMode(db)])
  return (
    <>
      <PageHeader title={tr("Access")} description={tr("Changes apply at once, without a restart, and override SIGNUP in the server’s .env.")} />
      <div className="grid gap-4 lg:gap-6">
        <Panel title={tr("Sign-up")} description={tr("Who can create an account on this server.")}>
          <ModeChoice kind="signup" value={signup} />
        </Panel>
        <Panel title={tr("AI coach")} description={tr("Each person adds their own AI provider key, so the coach costs this server nothing. Admins never see anyone’s key or chats.")}>
          <ModeChoice kind="coach" value={coach} />
        </Panel>
      </div>
    </>
  )
}
