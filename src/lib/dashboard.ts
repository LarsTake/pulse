// Home's My Dashboard catalogue: every metric the Home view model can show, grouped as the editor lists them
// (spec §7.1 row 8, §11 CD1, CD2). Stored keys are these keys; never rename one.
import type { GoodDirection } from "./bands"
import { EXTRA_METRICS, type ExtraKey } from "./extraMetrics"
import type { FormatKey } from "./format"
import { metricHref } from "./url"
import { t as tr } from "@/lib/i18n"

export const DASHBOARD_GROUPS = [
  { key: "recovery", label: tr("Recovery & sleep") },
  { key: "activity", label: tr("Activity") },
  { key: "body", label: tr("Body") },
  { key: "nutrition", label: tr("Nutrition") },
  { key: "vitals", label: tr("Vitals") },
] as const
export type DashboardGroup = (typeof DASHBOARD_GROUPS)[number]["key"]

/** The eight v1 rows; their units and reasons live in the Home query (`keyStats`). */
const CORE = [
  { key: "hrv", label: tr("Heart rate variability"), group: "recovery" },
  { key: "rhr", label: tr("Resting heart rate"), group: "recovery" },
  { key: "resp", label: tr("Respiratory rate"), group: "vitals" },
  { key: "sleep", label: tr("Sleep performance"), group: "recovery" },
  { key: "calories", label: tr("Calories"), group: "activity" },
  { key: "steps", label: tr("Steps"), group: "activity" },
  { key: "spo2", label: tr("Blood oxygen"), group: "vitals" },
  { key: "skin", label: tr("Skin temperature"), group: "vitals" },
] as const

/**
 * The reference app's other rows (dashboard-customize-*, dashboard-tiles-new-metrics*). Keys match the Trend View each opens where there is one;
 * "(weekly)" rows total the 7 days ending on the day and compare with the same 7-day total over the prior 30 days.
 */
const SCORED = [
  { key: "recovery", label: tr("Recovery"), group: "recovery" },
  { key: "consistency", label: tr("Sleep consistency"), group: "recovery" },
  { key: "hours", label: tr("Hours of sleep"), group: "recovery" },
  { key: "restorative_pct", label: tr("Restorative sleep (%)"), group: "recovery" },
  { key: "restorative", label: tr("Restorative sleep (hours)"), group: "recovery" },
  { key: "debt", label: tr("Sleep debt"), group: "recovery" },
  { key: "strain", label: tr("Day strain"), group: "activity" },
  { key: "zones13", label: tr("HR zones 1-3 (weekly)"), group: "activity" },
  { key: "zones45", label: tr("HR zones 4-5 (weekly)"), group: "activity" },
  { key: "zones_all", label: tr("HR zones all (weekly)"), group: "activity" },
  { key: "strength", label: tr("Strength activity time (weekly)"), group: "activity" },
  { key: "vo2max", label: tr("VO2 max"), group: "body" },
  { key: "lean_mass", label: tr("Lean body mass"), group: "body" },
] as const
export type ScoredKey = (typeof SCORED)[number]["key"]

/** Stress Monitor: a chart tile rather than a row (the day's stress line), placed and reordered like any metric. */
const STRESS = { key: "stress", label: tr("Stress Monitor"), group: "recovery" } as const

/** Google's weight and body-fat readings (daily_metrics); each opens its detail screen. */
export const BODY_METRICS = [
  { key: "weight", label: tr("Weight"), unit: "kg", format: "decimal1", direction: "neutral", href: metricHref("weight") },
  { key: "body_fat", label: tr("Body fat"), unit: "%", format: "decimal1", direction: "neutral", href: metricHref("body_fat") },
] as const satisfies readonly { key: string; label: string; unit: string; format: FormatKey; direction: GoodDirection; href: string }[]
export type BodyKey = (typeof BODY_METRICS)[number]["key"]

export type DashboardKey = (typeof CORE)[number]["key"] | ScoredKey | typeof STRESS.key | BodyKey | ExtraKey

const ALL: { key: DashboardKey; label: string; group: DashboardGroup }[] = [
  ...CORE,
  ...SCORED,
  STRESS,
  ...BODY_METRICS.map((m) => ({ key: m.key, label: m.label, group: "body" as const })),
  ...EXTRA_METRICS.map((m) => ({ key: m.key, label: m.label, group: m.group })),
]

/** Every metric, in editor order: by group, then catalogue order within it. */
export const DASHBOARD_METRICS = DASHBOARD_GROUPS.flatMap((g) => ALL.filter((m) => m.group === g.key))

export const DASHBOARD_LABEL = Object.fromEntries(ALL.map((m) => [m.key, m.label])) as Record<DashboardKey, string>

export const isDashboardKey = (k: string): k is DashboardKey => Object.hasOwn(DASHBOARD_LABEL, k)

/** The default list, the reference app's (dashboard-customize-reorder); installs that never saved a list follow it. */
export const DASHBOARD_DEFAULT: DashboardKey[] = ["hrv", "sleep", "consistency", "hours", "stress", "rhr", "vo2max", "steps"]

/** The default for an account that has never synced heart rate (phone only, no Fitbit band): what its phone counts. */
export const PHONE_DEFAULT: DashboardKey[] = ["steps", "distance", "calories", "active_minutes", "active_calories", "floors"]

/** Phone Home's lead card (spec §11 CD2): what a phone records without a band. */
export const PHONE_STATS: DashboardKey[] = ["steps", "distance", "calories", "active_minutes"]
