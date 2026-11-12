"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { deleteBodyLogEntry } from "@/server/actions/bodyLogs"
import { Button } from "@/components/ui/button"

/** A trash key that asks once more ("Tap again to delete") before deleting a blood pressure, lab or strength entry. */
export function DeleteEntry({ kind, id, label }: { kind: "bp" | "lab" | "strength"; id: string; label: string }) {
  const router = useRouter()
  const [armed, setArmed] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <Button
      type="button"
      variant={armed ? "destructive" : "ghost"}
      size={armed ? "touch" : "icon-touch"}
      disabled={busy}
      aria-label={armed ? `Confirm: delete ${label}` : `Delete ${label}`}
      onClick={async () => {
        if (!armed) return setArmed(true)
        setBusy(true)
        const r = await deleteBodyLogEntry({ kind, id })
        setBusy(false)
        setArmed(false)
        if (!r.ok) return void toast.error(r.error)
        router.refresh()
      }}
    >
      <Trash2 aria-hidden strokeWidth={1.75} />
      {armed && "Delete"}
    </Button>
  )
}
