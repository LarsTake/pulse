import { connection } from "next/server"
import { userCtx } from "@/server/queries/common"
import { getBehaviours } from "@/server/queries/journal"
import { DetailShell } from "@/components/shells/DetailShell"
import { Behaviours } from "./Behaviours"
import { t as tr } from "@/lib/i18n"

export const metadata = { title: tr("Behaviours") }

/** Behaviours `/more/behaviours` (U21): manage the journal check-in list. */
export default async function BehavioursPage() {
  await connection()
  return <DetailShell title={tr("Behaviours")} primary={<Behaviours vm={await getBehaviours(await userCtx())} />} />
}
