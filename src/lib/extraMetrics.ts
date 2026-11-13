// Google Health daily roll-ups Pulse shows as they come, without scoring them (docs/research/google-health-coverage.md).
// One entry per metric: My Dashboard, Trends and the daily export all read this list, so adding a metric here
// (and its value path in src/server/sources/google/map.ts) is all it takes to show it.
import type { GoodDirection } from "./bands"
import type { FormatKey } from "./format"
import { t as tr } from "@/lib/i18n"

export type ExtraMetric = {
  key: string
  label: string
  /** Shown after the value; minutes use h:mm via `format` instead. */
  unit?: string
  format: FormatKey
  direction: GoodDirection
  /** My Dashboard's editor group. Every extra opens its own detail screen, `/metric/<key>`. */
  group: "activity" | "nutrition" | "vitals"
  /** Accrues through the day: today is a gap in trends, not a low bar. */
  partialToday?: boolean
}

export const EXTRA_METRICS = [
  { key: "distance", label: tr("Distance"), unit: "km", format: "decimal2", direction: "up", group: "activity", partialToday: true },
  { key: "floors", label: tr("Floors"), format: "grouped", direction: "up", group: "activity", partialToday: true },
  { key: "elevation", label: tr("Elevation gain"), unit: "m", format: "int", direction: "up", group: "activity", partialToday: true },
  { key: "active_minutes", label: tr("Active minutes"), format: "duration", direction: "up", group: "activity", partialToday: true },
  { key: "light_minutes", label: tr("Light activity"), format: "duration", direction: "up", group: "activity", partialToday: true },
  { key: "azm", label: tr("Active Zone Minutes"), format: "duration", direction: "up", group: "activity", partialToday: true },
  { key: "active_calories", label: tr("Active calories"), unit: "kcal", format: "grouped", direction: "neutral", group: "activity", partialToday: true },
  { key: "sedentary_minutes", label: tr("Sedentary time"), format: "duration", direction: "down", group: "activity", partialToday: true },
  { key: "avg_hr", label: tr("Average heart rate"), unit: "bpm", format: "int", direction: "neutral", group: "activity" },
  { key: "water", label: tr("Water"), unit: "ml", format: "grouped", direction: "up", group: "nutrition", partialToday: true },
  { key: "calories_in", label: tr("Calories eaten"), unit: "kcal", format: "grouped", direction: "neutral", group: "nutrition", partialToday: true },
  { key: "protein", label: tr("Protein"), unit: "g", format: "int", direction: "neutral", group: "nutrition", partialToday: true },
  { key: "carbs", label: tr("Carbohydrates"), unit: "g", format: "int", direction: "neutral", group: "nutrition", partialToday: true },
  { key: "fat", label: tr("Fat"), unit: "g", format: "int", direction: "neutral", group: "nutrition", partialToday: true },
  { key: "glucose", label: tr("Blood glucose"), unit: "mg/dL", format: "int", direction: "neutral", group: "vitals" },
  { key: "core_temp", label: tr("Core temperature"), unit: "°C", format: "decimal1", direction: "neutral", group: "vitals" },
  { key: "swim_strokes", label: tr("Swim strokes"), format: "grouped", direction: "up", group: "activity", partialToday: true },
] as const satisfies readonly ExtraMetric[]

export type ExtraKey = (typeof EXTRA_METRICS)[number]["key"]

export const EXTRA_KEYS = EXTRA_METRICS.map((m) => m.key) as ExtraKey[]

export const extraMetric = (key: ExtraKey): ExtraMetric => EXTRA_METRICS.find((m) => m.key === key)!
