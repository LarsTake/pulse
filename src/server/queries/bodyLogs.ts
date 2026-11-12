// View models for Blood Pressure (/health/blood-pressure), Labs (/health/labs) and Strength (/strength).
import { bpCategory, bpSummary, bpWeekDelta, type BpCategory, type BpSummary } from "@/core/algorithms/bloodPressure";
import { LAB_GROUP_LABEL, LAB_MARKERS, latestLabs, labStatus, type LabLatest, type LabStatus } from "@/core/algorithms/labs";
import { bestsAndPrs, EXERCISES, exerciseDef, MUSCLES, muscularLoad, setsPerMuscle, tonnage, volumeStatus, type Muscle, type Pr, type StrengthSession, type VolumeStatus } from "@/core/algorithms/strength";
import { allLabs, bpSince, latestWeightKg, strengthSince } from "../bodyLogs";
import { addDays, localMidnight } from "../time";
import { loadDays, type QueryCtx, todayOf } from "./common";

const DAY_S = 86_400;

// ── Blood pressure ──────────────────────────────────────────────────────────

export type BpRow = { id: string; ts: number; day: string; systolic: number; diastolic: number; pulse: number | null; category: BpCategory };
export type BloodPressureVM = {
  latest: BpRow | null;
  week: BpSummary | null;
  month: BpSummary | null;
  weekDelta: { systolic: number; diastolic: number } | null;
  /** Daily means, oldest first, last 90 days (days without a reading are left out). */
  daily: { day: string; systolic: number; diastolic: number }[];
  /** Newest first, last 90 days. */
  readings: BpRow[];
};

export async function getBloodPressure(ctx: QueryCtx): Promise<BloodPressureVM> {
  const rows = await bpSince(ctx.db, ctx.userId, ctx.now - 90 * DAY_S);
  const readings: BpRow[] = rows.map((r) => ({ ...r, category: bpCategory(r.systolic, r.diastolic) })).reverse();
  const byDay = new Map<string, { s: number; d: number; n: number }>();
  for (const r of rows) {
    const x = byDay.get(r.day) ?? { s: 0, d: 0, n: 0 };
    byDay.set(r.day, { s: x.s + r.systolic, d: x.d + r.diastolic, n: x.n + 1 });
  }
  return {
    latest: readings[0] ?? null,
    week: bpSummary(rows, ctx.now - 7 * DAY_S, ctx.now + 1),
    month: bpSummary(rows, ctx.now - 30 * DAY_S, ctx.now + 1),
    weekDelta: bpWeekDelta(rows, ctx.now),
    daily: [...byDay].map(([day, x]) => ({ day, systolic: Math.round(x.s / x.n), diastolic: Math.round(x.d / x.n) })),
    readings,
  };
}

// ── Labs ────────────────────────────────────────────────────────────────────

export type LabsVM = {
  groups: { key: string; label: string; items: (Omit<LabLatest, "marker"> & { key: string; label: string; unit: string; dp: number })[] }[];
  /** Every result per marker, oldest first, for the per-marker history. */
  history: Record<string, { id: string; day: string; value: number; status: LabStatus }[]>;
  markers: { key: string; label: string; unit: string; group: string }[];
  lastTest: string | null;
  outOfRange: number;
};

export async function getLabs(ctx: QueryCtx): Promise<LabsVM> {
  const rows = await allLabs(ctx.db, ctx.userId);
  const latest = latestLabs(rows, ctx.profile.sex);
  const groups = Object.entries(LAB_GROUP_LABEL)
    .map(([key, label]) => ({
      key,
      label,
      items: latest.filter((l) => l.marker.group === key).map(({ marker: m, ...rest }) => ({ ...rest, key: m.key, label: m.label, unit: m.unit, dp: m.dp })),
    }))
    .filter((g) => g.items.length);
  const history: LabsVM["history"] = {};
  for (const r of [...rows].reverse()) {
    const m = LAB_MARKERS.find((x) => x.key === r.marker);
    if (!m) continue;
    const range = r.refLow !== null || r.refHigh !== null ? [r.refLow, r.refHigh] : m.range(ctx.profile.sex);
    (history[r.marker] ??= []).push({ id: r.id, day: r.day, value: r.value, status: labStatus(r.value, range[0], range[1]) });
  }
  return {
    groups,
    history,
    markers: LAB_MARKERS.map((m) => ({ key: m.key, label: m.label, unit: m.unit, group: LAB_GROUP_LABEL[m.group] })),
    lastTest: rows[0]?.day ?? null,
    outOfRange: latest.filter((l) => l.status === "low" || l.status === "high").length,
  };
}

// ── Strength ────────────────────────────────────────────────────────────────

export type StrengthSessionVM = {
  id: string;
  day: string;
  ts: number;
  durationMin: number | null;
  tonnage: number;
  load: number;
  sets: number;
  exercises: { key: string; label: string; sets: { reps: number; kg: number }[]; best: string }[];
  prs: Pr[];
};
export type StrengthVM = {
  /** This week, Monday to today: hard sets per muscle and their 10–20 band. */
  week: { muscle: Muscle; sets: number; status: VolumeStatus }[];
  weekStart: string;
  weekSessions: number;
  weekTonnage: number;
  /** Weekly tonnage, oldest first, last 8 weeks (Monday dates). */
  weekly: { week: string; tonnage: number; sessions: number }[];
  /** Newest first, last 8 weeks. */
  sessions: StrengthSessionVM[];
  exercises: { key: string; label: string }[];
  /** Today's muscular load (0–21), for Strain. */
  todayLoad: number | null;
};

const monday = (day: string) => {
  const dow = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(day, -dow);
};

export async function getStrength(ctx: QueryCtx): Promise<StrengthVM> {
  const today = todayOf(ctx);
  const weekStart = monday(today);
  const from = addDays(weekStart, -7 * 7);
  // A year of history for PRs and bests, so a PR means "best in a year", not "best in 8 weeks".
  const all = await strengthSince(ctx.db, ctx.userId, addDays(today, -366));
  const bodyKg = await latestWeightKg(ctx.db, ctx.userId);

  const vms: StrengthSessionVM[] = [];
  all.forEach((s, i) => {
    if (s.day < from) return;
    const { bests, prs } = bestsAndPrs(all.slice(0, i), s);
    vms.push({
      id: s.id,
      day: s.day,
      ts: s.ts,
      durationMin: s.durationMin,
      tonnage: tonnage(s, bodyKg),
      load: muscularLoad(s, bests),
      sets: s.exercises.reduce((n, x) => n + x.sets.length, 0),
      exercises: s.exercises.map((x) => ({
        key: x.key,
        label: exerciseDef(x.key)?.label ?? x.key,
        sets: x.sets,
        best: bestSetLabel(x.sets),
      })),
      prs,
    });
  });
  vms.reverse();

  const thisWeek: StrengthSession[] = all.filter((s) => s.day >= weekStart && s.day <= today);
  const sets = setsPerMuscle(thisWeek);
  const weekly: StrengthVM["weekly"] = [];
  for (let w = 7; w >= 0; w--) {
    const start = addDays(weekStart, -7 * w);
    const end = addDays(start, 6);
    const ss = vms.filter((s) => s.day >= start && s.day <= end);
    weekly.push({ week: start, tonnage: ss.reduce((n, s) => n + s.tonnage, 0), sessions: ss.length });
  }
  const todays = vms.filter((s) => s.day === today);
  return {
    week: MUSCLES.map((m) => ({ muscle: m, sets: Math.round(sets[m] * 2) / 2, status: volumeStatus(sets[m]) })),
    weekStart,
    weekSessions: thisWeek.length,
    weekTonnage: weekly.at(-1)?.tonnage ?? 0,
    weekly,
    sessions: vms,
    exercises: EXERCISES.map((e) => ({ key: e.key, label: e.label })),
    todayLoad: todays.length ? Math.round(Math.min(21, todays.reduce((n, s) => n + s.load, 0)) * 10) / 10 : null,
  };
}

function bestSetLabel(sets: { reps: number; kg: number }[]): string {
  const top = [...sets].sort((a, b) => b.kg - a.kg || b.reps - a.reps)[0];
  if (!top) return "";
  return top.kg > 0 ? `${top.kg} kg × ${top.reps}` : `${top.reps} reps`;
}

/** Local midnight of `day`, for "logged at" defaults. */
export const dayStart = (ctx: QueryCtx, day: string) => localMidnight(day, ctx.timeZone);

// ── Live heart rate ─────────────────────────────────────────────────────────

export type LiveHrVM = { restingHr: number; maxHr: number; restingSource: "measured" | "default" };

/** Resting (the newest of the last 14 days, else 60) and max heart rate for the live screen's zones and strain. */
export async function getLiveHr(ctx: QueryCtx): Promise<LiveHrVM> {
  const today = todayOf(ctx);
  const days = await loadDays(ctx, addDays(today, -14), today);
  let rhr: number | null = null;
  for (let d = today; d >= addDays(today, -14) && rhr === null; d = addDays(d, -1)) rhr = days.get(d)?.metrics?.rhrBpm ?? null;
  return { restingHr: Math.round(rhr ?? 60), maxHr: ctx.profile.maxHr, restingSource: rhr === null ? "default" : "measured" };
}
