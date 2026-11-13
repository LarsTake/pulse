"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { LAB_GROUP_LABEL, LAB_MARKERS } from "@/core/algorithms/labs"
import { logBloodPressure, logLabResults } from "@/server/actions/bodyLogs"
import { CAPTION } from "@/components/metrics/primitives"
import { ResponsiveSheet } from "@/components/shells/ResponsiveSheet"
import { closeSheet } from "@/components/shells/SheetTrigger"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FIELD, nowLocal, parseNum, Section, todayLocal } from "../_lib/forms"
import { t as tr } from "@/lib/i18n"

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <Alert role="alert" className="border-0 bg-recovery-red/15 px-3 py-2">
      <AlertDescription className="text-recovery-red-text">{error}</AlertDescription>
    </Alert>
  ) : null
}

/** Log blood pressure (`?bp=1`): systolic, diastolic, pulse and time. */
export function BpSheet() {
  const params = useSearchParams()
  const router = useRouter()
  const open = params.has("bp")
  const [f, setF] = React.useState({ sys: "", dia: "", pulse: "", at: "" })
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setF({ sys: "", dia: "", pulse: "", at: nowLocal() })
      setError(null)
    }
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }))

  async function save() {
    setError(null)
    const systolic = parseNum(f.sys)
    const diastolic = parseNum(f.dia)
    const pulse = parseNum(f.pulse)
    if (systolic === null || diastolic === null || Number.isNaN(systolic) || Number.isNaN(diastolic)) return setError("Enter both numbers from the cuff.")
    if (Number.isNaN(pulse)) return setError("Pulse: a whole number, or leave it empty.")
    setSaving(true)
    const r = await logBloodPressure({ systolic, diastolic, pulse, at: f.at || undefined })
    setSaving(false)
    if (!r.ok) return setError(r.error)
    toast.success("Reading saved")
    closeSheet("bp")
    router.refresh()
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(o) => !o && !saving && closeSheet("bp")}
      title={tr("Log blood pressure")}
      description={tr("Saved in Pulse only")}
      footer={
        <>
          <ErrorLine error={error} />
          <Button size="sheet" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Section title={tr("Reading")}>
          <div className="grid grid-cols-3 gap-2">
            <Field id="bp-sys" label={tr("Systolic")} hint="(top)">
              <Input id="bp-sys" inputMode="numeric" autoComplete="off" placeholder="120" value={f.sys} onChange={set("sys")} className={FIELD} autoFocus />
            </Field>
            <Field id="bp-dia" label={tr("Diastolic")} hint="(bottom)">
              <Input id="bp-dia" inputMode="numeric" autoComplete="off" placeholder="80" value={f.dia} onChange={set("dia")} className={FIELD} />
            </Field>
            <Field id="bp-pulse" label={tr("Pulse")}>
              <Input id="bp-pulse" inputMode="numeric" autoComplete="off" placeholder={tr("Optional")} value={f.pulse} onChange={set("pulse")} className={FIELD} />
            </Field>
          </div>
          <p className={CAPTION}>{tr("mmHg. Sit quietly for 5 minutes first, arm at heart height; two readings a minute apart beat one.")}</p>
        </Section>
        <Section title={tr("When")}>
          <Field id="bp-at" label={tr("Time")} hint={tr("(empty: now)")}>
            <Input id="bp-at" type="datetime-local" max={nowLocal()} value={f.at} onChange={set("at")} className={FIELD} />
          </Field>
        </Section>
        <button type="submit" hidden />
      </form>
    </ResponsiveSheet>
  )
}

type Row = { marker: string; value: string; low: string; high: string; own: boolean }

/** Log lab results (`?labs=1`): a test day, then any markers from the catalogue, each with the lab's range if printed. */
export function LabSheet() {
  const params = useSearchParams()
  const router = useRouter()
  const open = params.has("labs")
  const [day, setDay] = React.useState("")
  const [rows, setRows] = React.useState<Row[]>([])
  const [adding, setAdding] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDay(todayLocal())
      setRows([])
      setAdding("")
      setError(null)
    }
  }
  const used = new Set(rows.map((r) => r.marker))
  const upd = (i: number, k: keyof Row, v: string | boolean) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)))

  async function save() {
    setError(null)
    const results = []
    for (const r of rows) {
      const m = LAB_MARKERS.find((x) => x.key === r.marker)!
      const value = parseNum(r.value)
      if (value === null) continue
      const refLow = r.own ? parseNum(r.low) : null
      const refHigh = r.own ? parseNum(r.high) : null
      if ([value, refLow, refHigh].some((x) => Number.isNaN(x))) return setError(`${m.label}: numbers only.`)
      results.push({ marker: r.marker, value, refLow, refHigh })
    }
    if (!results.length) return setError("Enter at least one value.")
    setSaving(true)
    const r = await logLabResults({ day: day || todayLocal(), results })
    setSaving(false)
    if (!r.ok) return setError(r.error)
    toast.success(`${r.data.count} ${r.data.count === 1 ? "result" : "results"} saved`)
    closeSheet("labs")
    router.refresh()
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(o) => !o && !saving && closeSheet("labs")}
      title={tr("Log lab results")}
      description={tr("Saved in Pulse only")}
      size="tall"
      footer={
        <>
          <ErrorLine error={error} />
          <Button size="sheet" onClick={save} disabled={saving || !rows.length}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Section title={tr("Test day")}>
          <Field id="lab-day" label={tr("Blood drawn on")}>
            <Input id="lab-day" type="date" max={todayLocal()} value={day} onChange={(e) => setDay(e.target.value)} className={FIELD} />
          </Field>
        </Section>

        {rows.map((r, i) => {
          const m = LAB_MARKERS.find((x) => x.key === r.marker)!
          return (
            <Section
              key={r.marker}
              title={m.label}
              action={
                <Button type="button" variant="ghost" size="icon-touch" aria-label={tr("Remove {0}", [m.label])} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                  <X aria-hidden strokeWidth={1.75} />
                </Button>
              }
            >
              <Field id={`lab-${r.marker}`} label={tr("Value")} hint={`(${m.unit})`}>
                <Input id={`lab-${r.marker}`} inputMode="decimal" autoComplete="off" value={r.value} onChange={(e) => upd(i, "value", e.target.value)} className={FIELD} />
              </Field>
              {r.own ? (
                <div className="grid grid-cols-2 gap-2">
                  <Field id={`lab-${r.marker}-lo`} label={tr("Range from")}>
                    <Input id={`lab-${r.marker}-lo`} inputMode="decimal" placeholder="none" value={r.low} onChange={(e) => upd(i, "low", e.target.value)} className={FIELD} />
                  </Field>
                  <Field id={`lab-${r.marker}-hi`} label="to">
                    <Input id={`lab-${r.marker}-hi`} inputMode="decimal" placeholder="none" value={r.high} onChange={(e) => upd(i, "high", e.target.value)} className={FIELD} />
                  </Field>
                </div>
              ) : (
                <button type="button" className={cn(CAPTION, "self-start underline underline-offset-4")} onClick={() => upd(i, "own", true)}>
                  {tr("Use the range printed on your report")}</button>
              )}
            </Section>
          )
        })}

        <Section title={tr("Add a marker")}>
          <div className="flex gap-2">
            <select
              aria-label={tr("Marker")}
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-input/30 px-3 text-base text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">{tr("Choose…")}</option>
              {Object.entries(LAB_GROUP_LABEL).map(([g, label]) => (
                <optgroup key={g} label={label}>
                  {LAB_MARKERS.filter((m) => m.group === g && !used.has(m.key)).map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label} ({m.unit})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <Button
              type="button"
              variant="secondary"
              size="touch"
              disabled={!adding}
              onClick={() => {
                setRows((rs) => [...rs, { marker: adding, value: "", low: "", high: "", own: false }])
                setAdding("")
              }}
            >
              <Plus aria-hidden strokeWidth={1.75} />
              {tr("Add")}</Button>
          </div>
          <p className={CAPTION}>{tr("Units as listed; convert if your lab reports others (e.g. mmol/L cholesterol × 38.67 = mg/dL).")}</p>
        </Section>
        <button type="submit" hidden />
      </form>
    </ResponsiveSheet>
  )
}
