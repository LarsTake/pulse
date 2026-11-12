"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { SHEET_SECTION } from "@/components/shells/ResponsiveSheet"

/** Numeric field height and type, as the Journal's log sheets. */
export const FIELD = "h-11 font-numeric text-base tabular-nums"

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={id} className="text-[15px] leading-[22px] font-medium">
        {label}
        {hint && <span className="font-normal text-muted-foreground"> {hint}</span>}
      </Label>
      {children}
    </div>
  )
}

/** A caps section heading inside a sheet, with a hairline to the edge. */
export const Section = ({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) => (
  <section className="mt-6 flex flex-col gap-3 first:mt-2">
    <div className="flex items-center gap-3">
      <h3 className={`${SHEET_SECTION} flex-1`}>{title}</h3>
      {action}
    </div>
    {children}
  </section>
)

/** "12.5" or "12,5" to a number; "" to null; anything else to NaN. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(",", ".")
  if (!t) return null
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN
}

/** Local wall time now, `YYYY-MM-DDTHH:mm`, for a datetime-local default. */
export function nowLocal(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export const todayLocal = () => nowLocal().slice(0, 10)
