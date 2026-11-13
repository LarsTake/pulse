import { listInvites, signupMode } from "@/server/admin"
import { adminGate } from "../gate"
import { InviteList, NewInvite } from "../Invites"
import { PageHeader } from "../ui"
import { t as tr } from "@/lib/i18n"

export const metadata = { title: tr("Invites") }

const requestTime = () => Date.now()

/** Admin › Invites `/admin/invites`: make a one-time sign-up link, and see which are waiting, used or expired. */
export default async function InvitesPage() {
  const { db } = await adminGate()
  const [invites, signup] = await Promise.all([listInvites(db), signupMode(db)])
  return (
    <>
      <PageHeader title={tr("Invites")} description={tr("Each link lets one person create an account. Only its fingerprint is stored, so a link is shown once.")} />
      <NewInvite signup={signup} />
      <InviteList invites={invites} now={requestTime()} />
    </>
  )
}
