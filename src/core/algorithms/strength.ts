// Strength training the user logs set by set. Pure: no I/O.
//
// Three outputs:
// - Hard sets per muscle per week, against the 10–20 set range that meta-analyses find for hypertrophy
//   (Schoenfeld, Ogborn & Krieger 2017; Baz-Valle et al. 2022). A secondary muscle counts half a set.
// - Estimated one-rep max per exercise (Epley 1985: kg × (1 + reps / 30)), trusted up to 12 reps, for PRs.
// - Muscular load on Pulse's 0–21 strain scale: 21 × (1 − e^(−sets / 25)), where sets are hard sets weighted by
//   relative intensity. A heart-rate band under-reads lifting; this is the part it misses. An estimate, labelled so.

export const MUSCLES = ["chest", "back", "shoulders", "biceps", "triceps", "forearms", "core", "glutes", "quads", "hamstrings", "calves"] as const;
export type Muscle = (typeof MUSCLES)[number];

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  core: "Core",
  glutes: "Glutes",
  quads: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
};

export type ExerciseDef = { key: string; label: string; primary: Muscle[]; secondary: Muscle[]; bodyweight?: boolean };

export const EXERCISES: ExerciseDef[] = [
  { key: "bench_press", label: "Bench press", primary: ["chest"], secondary: ["triceps", "shoulders"] },
  { key: "incline_bench", label: "Incline bench press", primary: ["chest", "shoulders"], secondary: ["triceps"] },
  { key: "db_press", label: "Dumbbell press", primary: ["chest"], secondary: ["triceps", "shoulders"] },
  { key: "push_up", label: "Push-up", primary: ["chest"], secondary: ["triceps", "shoulders", "core"], bodyweight: true },
  { key: "dip", label: "Dip", primary: ["chest", "triceps"], secondary: ["shoulders"], bodyweight: true },
  { key: "fly", label: "Chest fly", primary: ["chest"], secondary: [] },
  { key: "pull_up", label: "Pull-up", primary: ["back", "biceps"], secondary: ["forearms"], bodyweight: true },
  { key: "lat_pulldown", label: "Lat pulldown", primary: ["back"], secondary: ["biceps"] },
  { key: "barbell_row", label: "Barbell row", primary: ["back"], secondary: ["biceps", "forearms"] },
  { key: "cable_row", label: "Cable row", primary: ["back"], secondary: ["biceps"] },
  { key: "deadlift", label: "Deadlift", primary: ["back", "glutes", "hamstrings"], secondary: ["quads", "forearms", "core"] },
  { key: "overhead_press", label: "Overhead press", primary: ["shoulders"], secondary: ["triceps", "core"] },
  { key: "lateral_raise", label: "Lateral raise", primary: ["shoulders"], secondary: [] },
  { key: "face_pull", label: "Face pull", primary: ["shoulders", "back"], secondary: [] },
  { key: "curl", label: "Biceps curl", primary: ["biceps"], secondary: ["forearms"] },
  { key: "hammer_curl", label: "Hammer curl", primary: ["biceps", "forearms"], secondary: [] },
  { key: "triceps_pushdown", label: "Triceps pushdown", primary: ["triceps"], secondary: [] },
  { key: "skull_crusher", label: "Skull crusher", primary: ["triceps"], secondary: [] },
  { key: "squat", label: "Back squat", primary: ["quads", "glutes"], secondary: ["hamstrings", "core"] },
  { key: "front_squat", label: "Front squat", primary: ["quads"], secondary: ["glutes", "core"] },
  { key: "leg_press", label: "Leg press", primary: ["quads", "glutes"], secondary: [] },
  { key: "lunge", label: "Lunge", primary: ["quads", "glutes"], secondary: ["hamstrings"] },
  { key: "rdl", label: "Romanian deadlift", primary: ["hamstrings", "glutes"], secondary: ["back"] },
  { key: "leg_curl", label: "Leg curl", primary: ["hamstrings"], secondary: [] },
  { key: "leg_extension", label: "Leg extension", primary: ["quads"], secondary: [] },
  { key: "hip_thrust", label: "Hip thrust", primary: ["glutes"], secondary: ["hamstrings"] },
  { key: "calf_raise", label: "Calf raise", primary: ["calves"], secondary: [] },
  { key: "plank", label: "Plank", primary: ["core"], secondary: [], bodyweight: true },
  { key: "crunch", label: "Crunch", primary: ["core"], secondary: [], bodyweight: true },
  { key: "hanging_leg_raise", label: "Hanging leg raise", primary: ["core"], secondary: ["forearms"], bodyweight: true },
];

const BY_KEY = new Map(EXERCISES.map((e) => [e.key, e]));
export const exerciseDef = (key: string) => BY_KEY.get(key) ?? null;

export type StrengthSet = { reps: number; kg: number };
export type StrengthExercise = { key: string; sets: StrengthSet[] };
export type StrengthSession = { id: string; day: string; ts: number; durationMin: number | null; exercises: StrengthExercise[] };

/** Epley's estimated one-rep max; null above 12 reps, where it stops being useful. */
export function e1rm(set: StrengthSet): number | null {
  if (set.reps < 1 || set.reps > 12 || set.kg <= 0) return null;
  return set.reps === 1 ? set.kg : set.kg * (1 + set.reps / 30);
}

/** Hard sets per muscle in the sessions given: 1 per set for a primary muscle, 0.5 for a secondary. */
export function setsPerMuscle(sessions: StrengthSession[]): Record<Muscle, number> {
  const out = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>;
  for (const s of sessions)
    for (const x of s.exercises) {
      const def = BY_KEY.get(x.key);
      if (!def) continue;
      const n = x.sets.filter((st) => st.reps > 0).length;
      for (const m of def.primary) out[m] += n;
      for (const m of def.secondary) out[m] += n / 2;
    }
  return out;
}

export type VolumeStatus = "none" | "low" | "optimal" | "high";
/** 10–20 weekly hard sets per muscle; under 10 still counts, over 20 adds fatigue faster than growth. */
export function volumeStatus(sets: number): VolumeStatus {
  if (sets <= 0) return "none";
  if (sets < 10) return "low";
  if (sets <= 20) return "optimal";
  return "high";
}

/** Tonnage in kg: reps × load. A bodyweight exercise with no added load counts `bodyKg` × 0.65. */
export function tonnage(session: StrengthSession, bodyKg: number | null): number {
  const bw = (bodyKg ?? 75) * 0.65;
  let t = 0;
  for (const x of session.exercises) {
    const def = BY_KEY.get(x.key);
    for (const s of x.sets) t += s.reps * (s.kg > 0 ? s.kg : def?.bodyweight ? bw : 0);
  }
  return Math.round(t);
}

/**
 * Muscular load of one session on the 0–21 scale. Each set weighs by its load against the exercise's best estimated
 * 1RM in `bests` (a set at 80% of 1RM counts 1, lighter sets less, down to 0.5); a set with no 1RM to compare counts 1.
 */
export function muscularLoad(session: StrengthSession, bests: Map<string, number> = new Map()): number {
  let w = 0;
  for (const x of session.exercises) {
    const best = bests.get(x.key);
    for (const s of x.sets) {
      if (s.reps <= 0) continue;
      if (!best || s.kg <= 0) {
        w += 1;
        continue;
      }
      const rel = s.kg / best;
      w += Math.min(1.2, Math.max(0.5, rel / 0.8));
    }
  }
  return Math.round(21 * (1 - Math.exp(-w / 25)) * 10) / 10;
}

export type Pr = { key: string; label: string; e1rm: number; set: StrengthSet; day: string };

/**
 * The best estimated 1RM per exercise over `history`, and which sets in `session` beat everything before it.
 * `history` is every earlier session, oldest first; `session` is not in it.
 */
export function bestsAndPrs(history: StrengthSession[], session?: StrengthSession): { bests: Map<string, number>; prs: Pr[] } {
  const bests = new Map<string, number>();
  for (const s of history)
    for (const x of s.exercises)
      for (const st of x.sets) {
        const v = e1rm(st);
        if (v !== null && v > (bests.get(x.key) ?? 0)) bests.set(x.key, v);
      }
  const prs: Pr[] = [];
  if (session)
    for (const x of session.exercises) {
      let top: { v: number; set: StrengthSet } | null = null;
      for (const st of x.sets) {
        const v = e1rm(st);
        if (v !== null && (!top || v > top.v)) top = { v, set: st };
      }
      const prev = bests.get(x.key);
      if (top && prev !== undefined && top.v > prev + 0.01) prs.push({ key: x.key, label: BY_KEY.get(x.key)?.label ?? x.key, e1rm: Math.round(top.v * 10) / 10, set: top.set, day: session.day });
    }
  return { bests, prs };
}
