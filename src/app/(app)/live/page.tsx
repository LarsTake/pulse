import { connection } from "next/server"
import { userCtx } from "@/server/queries/common"
import { getLiveHr } from "@/server/queries/bodyLogs"
import { Tag } from "@/components/metrics/primitives"
import { DetailShell } from "@/components/shells/DetailShell"
import { LiveHr } from "./LiveHr"

export const metadata = { title: "Live heart rate" }

const INFO = {
  title: "About live heart rate",
  body: (
    <>
      <p>
        Pulse connects straight to your band’s standard Bluetooth heart-rate signal. Nothing goes through Google: the reading is live, about once a
        second.
      </p>
      <p>
        On a Fitbit Air, turn on heart-rate sharing first: Google Health app › Connections › Air › Share heart rate. Then tap Connect band and pick it.
        Works in Chrome and Edge on a computer or Android phone; Safari has no Web Bluetooth.
      </p>
      <p>Session Strain uses the same Edwards zones as your day’s Strain. When the band sends beat-to-beat intervals, Pulse also shows a rolling HRV (RMSSD).</p>
    </>
  ),
}

export default async function LivePage() {
  await connection()
  const vm = await getLiveHr(await userCtx())
  return <DetailShell title="Live heart rate" info={INFO} action={<Tag kind="beta" />} hero={<LiveHr vm={vm} />} />
}
