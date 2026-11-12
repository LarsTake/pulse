"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Copy, Minus, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { EXERCISES, exerciseDef, MUSCLE_LABEL } from "@/core/algorithms/strength"
import { logStrengthSession } from "@/server/actions/bodyLogs"
import { CAPTION, LABEL } from "@/components/metrics/primitives"
import { ResponsiveSheet } from "@/components/shells/ResponsiveSheet"
import { closeSheet } from "@/components/shells/SheetTrigger"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FIELD, nowLocal, parseNum, Section } from "../_lib/forms"

type SetRow = { reps: string; kg: string }
type Ex = { key: string; sets: SetRow[] }

const SET_INPUT = "h-11 w-full text-center font-numeric text-base tabular-nums"

/** Exercise search: catalogue order, filtered by name or muscle. */
function Picker({ onPick, used }: { onPick: (key: string) => void; used: Set<string> }) {
  const [q, setQ] = React.useState("")
  const list = EXERCISES.filter((e) => {
    const t = q.trim().toLowerCase()
    if (!t) return true
    return e.label.toLowerCase().includes(t) || [...e.primary, ...e.secondary].some((m) => MUSCLE_LABEL[m].toLowerCase().includes(t))
  })
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Find an exercise" placeholder="Exercise or muscle" value={q} onChange={(e) => setQ(e.target.value)} className="h-11 pl-10 text-base" />
      </div>
      <ul className="max-h-64 overflow-y-auto rounded-xl bg-secondary/40 p-1">
        {list.map((e) => (
          <li key={e.key}>
            <button
              type="button"
              onClick={() => onPick(e.key)}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left outline-none hover:bg-foreground/[0.06] focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="text-[15px] leading-5 font-medium">
                {e.label}
                {used.has(e.key) && <span className="ml-2 text-xs text-muted-foreground">added</span>}
              </span>
              <span className={CAPTION}>{e.primary.map((m) => MUSCLE_LABEL[m]).join(", ")}</span>
            </button>
          </li>
        ))}
        {!list.length && <li className={cn(CAPTION, "px-3 py-3")}>No exercise matches.</li>}
      </ul>
    </div>
  )
}

/**
 * Strength trainer (`?strength=1`, from My Day's "+" and Strength): exercises, then sets of reps × kg. Kept in Pulse;
 * Strength shows weekly sets per muscle, PRs and the muscular load a heart-rate band misses.
 */
export function StrengthSheet() {
  const params = useSearchParams()
  const router = useRouter()
  const open = params.has("strength")
  const [exs, setExs] = React.useState<Ex[]>([])
  const [picking, setPicking] = React.useState(true)
  const [at, setAt] = React.useState("")
  const [duration, setDuration] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  // A fresh form each time the sheet opens (state adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setExs([])
      setPicking(true)
      setAt(nowLocal())
      setDuration("")
      setError(null)
    }
  }

  const update = (i: number, f: (e: Ex) => Ex) => setExs((xs) => xs.map((x, j) => (j === i ? f(x) : x)))
  const used = new Set(exs.map((e) => e.key))

  async function save() {
    setError(null)
    const exercises: { key: string; sets: { reps: number; kg: number }[] }[] = []
    for (const e of exs) {
      const sets: { reps: number; kg: number }[] = []
      for (const s of e.sets) {
        const reps = parseNum(s.reps)
        const kg = parseNum(s.kg) ?? 0
        if (reps === null && !s.kg.trim()) continue
        if (reps === null || Number.isNaN(reps) || Number.isNaN(kg)) return setError(`${exerciseDef(e.key)?.label}: enter reps and weight as numbers.`)
        sets.push({ reps, kg })
      }
      if (sets.length) exercises.push({ key: e.key, sets })
    }
    if (!exercises.length) return setError("Add an exercise with at least one set.")
    const d = parseNum(duration)
    if (Number.isNaN(d)) return setError("Duration: a number of minutes.")
    setSaving(true)
    const r = await logStrengthSession({ at: at || undefined, durationMin: d, exercises })
    setSaving(false)
    if (!r.ok) return setError(r.error)
    toast.success("Session saved")
    closeSheet("strength")
    router.refresh()
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(o) => !o && !saving && closeSheet("strength")}
      title="Strength trainer"
      description="Saved in Pulse only"
      size="tall"
      footer={
        <>
          {error && (
            <Alert role="alert" className="border-0 bg-recovery-red/15 px-3 py-2">
              <AlertDescription className="text-recovery-red-text">{error}</AlertDescription>
            </Alert>
          )}
          <Button size="sheet" onClick={save} disabled={saving || !exs.length}>
            {saving ? "Saving…" : "Save session"}
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
        {exs.map((e, i) => {
          const def = exerciseDef(e.key)!
          return (
            <Section
              key={`${e.key}-${i}`}
              title={def.label}
              action={
                <Button type="button" variant="ghost" size="icon-touch" aria-label={`Remove ${def.label}`} onClick={() => setExs((xs) => xs.filter((_, j) => j !== i))}>
                  <Trash2 aria-hidden strokeWidth={1.75} />
                </Button>
              }
            >
              <div className="grid grid-cols-[2rem_1fr_1fr_2.75rem] items-center gap-2">
                <span className={cn(LABEL, "text-muted-foreground")}>Set</span>
                <span className={cn(LABEL, "text-center text-muted-foreground")}>Reps</span>
                <span className={cn(LABEL, "text-center text-muted-foreground")}>{def.bodyweight ? "+kg" : "kg"}</span>
                <span />
                {e.sets.map((s, k) => (
                  <React.Fragment key={k}>
                    <span className="font-numeric text-[15px] font-bold tabular-nums">{k + 1}</span>
                    <Input
                      aria-label={`${def.label} set ${k + 1} reps`}
                      inputMode="numeric"
                      value={s.reps}
                      onChange={(ev) => update(i, (x) => ({ ...x, sets: x.sets.map((y, m) => (m === k ? { ...y, reps: ev.target.value } : y)) }))}
                      className={SET_INPUT}
                    />
                    <Input
                      aria-label={`${def.label} set ${k + 1} weight in kg`}
                      inputMode="decimal"
                      placeholder={def.bodyweight ? "0" : ""}
                      value={s.kg}
                      onChange={(ev) => update(i, (x) => ({ ...x, sets: x.sets.map((y, m) => (m === k ? { ...y, kg: ev.target.value } : y)) }))}
                      className={SET_INPUT}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-touch"
                      aria-label={`Remove set ${k + 1}`}
                      disabled={e.sets.length === 1}
                      onClick={() => update(i, (x) => ({ ...x, sets: x.sets.filter((_, m) => m !== k) }))}
                    >
                      <Minus aria-hidden strokeWidth={1.75} />
                    </Button>
                  </React.Fragment>
                ))}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="touch"
                onClick={() => update(i, (x) => ({ ...x, sets: [...x.sets, { ...(x.sets.at(-1) ?? { reps: "", kg: "" }) }] }))}
              >
                <Copy aria-hidden strokeWidth={1.75} />
                Add set
              </Button>
            </Section>
          )
        })}

        {picking ? (
          <Section title={exs.length ? "Add exercise" : "Choose an exercise"}>
            <Picker
              used={used}
              onPick={(key) => {
                setExs((xs) => [...xs, { key, sets: [{ reps: "", kg: "" }] }])
                setPicking(false)
              }}
            />
          </Section>
        ) : (
          <Button type="button" variant="secondary" size="touch" className="mt-6 w-full" onClick={() => setPicking(true)}>
            <Plus aria-hidden strokeWidth={1.75} />
            Add exercise
          </Button>
        )}

        <Section title="Session">
          <div className="grid grid-cols-2 gap-2">
            <Field id="strength-at" label="Started" hint="(empty: now)">
              <Input id="strength-at" type="datetime-local" max={nowLocal()} value={at} onChange={(e) => setAt(e.target.value)} className={FIELD} />
            </Field>
            <Field id="strength-min" label="Duration" hint="(min)">
              <Input id="strength-min" inputMode="numeric" placeholder="Optional" value={duration} onChange={(e) => setDuration(e.target.value)} className={FIELD} />
            </Field>
          </div>
        </Section>
        <button type="submit" hidden />
      </form>
    </ResponsiveSheet>
  )
}
