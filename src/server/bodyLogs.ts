// Blood pressure, lab results and strength sessions: kept in Pulse only, never written to Google. Validation here,
// session checks in actions/bodyLogs.ts. Every read and write filters on the user.
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { BP_LIMITS, type BpReading } from "@/core/algorithms/bloodPressure";
import { labMarker, type LabResult } from "@/core/algorithms/labs";
import { exerciseDef, type StrengthSession } from "@/core/algorithms/strength";
import type { Db } from "./db";
import { bpReadings, labResults, loggedEntries, strengthSessions } from "./db/schema";
import { fromWall, localDay } from "./time";
import { t as tr } from "@/lib/i18n"

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

const At = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a time").optional();
const int = (lo: number, hi: number, what: string) => z.number().int(`${what}: whole numbers`).min(lo, `${what}: ${lo} to ${hi}`).max(hi, `${what}: ${lo} to ${hi}`);

function when(at: string | undefined, tz: string, now: number): Result<number> {
  const ts = at ? fromWall(at, tz) : now;
  if (ts > now + 60) return { ok: false, error: tr("Can’t log the future") };
  if (ts < now - 20 * 366 * 86_400) return { ok: false, error: tr("That is too far back") };
  return { ok: true, data: ts };
}

// ── Blood pressure ──────────────────────────────────────────────────────────

export const BpInput = z
  .object({
    systolic: int(...BP_LIMITS.systolic, "Systolic"),
    diastolic: int(...BP_LIMITS.diastolic, "Diastolic"),
    pulse: int(...BP_LIMITS.pulse, "Pulse").nullable(),
    at: At,
  })
  .refine((v) => v.systolic > v.diastolic, "Systolic is the higher number");
export type BpInput = z.input<typeof BpInput>;

export async function addBp(db: Db, userId: number, input: BpInput, tz: string, now: number): Promise<Result<{ id: string }>> {
  const r = BpInput.safeParse(input);
  if (!r.success) return { ok: false, error: r.error.issues[0].message };
  const t = when(r.data.at, tz, now);
  if (!t.ok) return t;
  const id = randomUUID();
  await db.insert(bpReadings).values({ userId, id, ts: t.data, day: localDay(t.data, tz), systolic: r.data.systolic, diastolic: r.data.diastolic, pulse: r.data.pulse, createdAt: now });
  return { ok: true, data: { id } };
}

export async function bpSince(db: Db, userId: number, from: number): Promise<(BpReading & { id: string; day: string })[]> {
  const rows = await db
    .select({ id: bpReadings.id, ts: bpReadings.ts, day: bpReadings.day, systolic: bpReadings.systolic, diastolic: bpReadings.diastolic, pulse: bpReadings.pulse })
    .from(bpReadings)
    .where(and(eq(bpReadings.userId, userId), gte(bpReadings.ts, from)))
    .orderBy(asc(bpReadings.ts));
  return rows;
}

// ── Labs ────────────────────────────────────────────────────────────────────

const num = z.number().finite();
export const LabInput = z.object({
  day: z.iso.date("Choose the test day"),
  results: z
    .array(z.object({ marker: z.string().refine((k) => labMarker(k) !== null, "Unknown marker"), value: num.min(0, "Values are not negative").max(100_000), refLow: num.nullable(), refHigh: num.nullable() }))
    .min(1, "Enter at least one value")
    .max(40),
});
export type LabInput = z.input<typeof LabInput>;

export async function addLabs(db: Db, userId: number, input: LabInput, tz: string, now: number): Promise<Result<{ count: number }>> {
  const r = LabInput.safeParse(input);
  if (!r.success) return { ok: false, error: r.error.issues[0].message };
  if (r.data.day > localDay(now, tz)) return { ok: false, error: tr("Can’t log a future day") };
  for (const x of r.data.results) if (x.refLow !== null && x.refHigh !== null && x.refLow > x.refHigh) return { ok: false, error: tr("The range’s low end is above its high end") };
  await db.insert(labResults).values(r.data.results.map((x) => ({ userId, id: randomUUID(), day: r.data.day, marker: x.marker, value: x.value, refLow: x.refLow, refHigh: x.refHigh, createdAt: now })));
  return { ok: true, data: { count: r.data.results.length } };
}

export async function allLabs(db: Db, userId: number): Promise<(LabResult & { id: string })[]> {
  return db
    .select({ id: labResults.id, marker: labResults.marker, day: labResults.day, value: labResults.value, refLow: labResults.refLow, refHigh: labResults.refHigh })
    .from(labResults)
    .where(eq(labResults.userId, userId))
    .orderBy(desc(labResults.day));
}

// ── Strength ────────────────────────────────────────────────────────────────

export const StrengthInput = z.object({
  at: At,
  durationMin: z.number().int().min(1, "Duration: 1 to 600 min").max(600, "Duration: 1 to 600 min").nullable(),
  exercises: z
    .array(
      z.object({
        key: z.string().refine((k) => exerciseDef(k) !== null, "Unknown exercise"),
        sets: z
          .array(z.object({ reps: z.number().int().min(1, "Reps: 1 to 200").max(200, "Reps: 1 to 200"), kg: z.number().min(0, "Weight: 0 to 600 kg").max(600, "Weight: 0 to 600 kg") }))
          .min(1, "Every exercise needs a set")
          .max(30),
      }),
    )
    .min(1, "Add an exercise")
    .max(30),
});
export type StrengthInput = z.input<typeof StrengthInput>;

export async function addStrength(db: Db, userId: number, input: StrengthInput, tz: string, now: number): Promise<Result<{ id: string }>> {
  const r = StrengthInput.safeParse(input);
  if (!r.success) return { ok: false, error: r.error.issues[0].message };
  const t = when(r.data.at, tz, now);
  if (!t.ok) return t;
  const id = randomUUID();
  const exercises = r.data.exercises.map((x) => ({ key: x.key, sets: x.sets.map((s) => ({ reps: s.reps, kg: Math.round(s.kg * 4) / 4 })) }));
  await db.insert(strengthSessions).values({ userId, id, ts: t.data, day: localDay(t.data, tz), durationMin: r.data.durationMin, exercises, createdAt: now });
  return { ok: true, data: { id } };
}

export async function strengthSince(db: Db, userId: number, fromDay: string): Promise<StrengthSession[]> {
  const rows = await db
    .select()
    .from(strengthSessions)
    .where(and(eq(strengthSessions.userId, userId), gte(strengthSessions.day, fromDay)))
    .orderBy(asc(strengthSessions.ts));
  return rows.map((r) => ({ id: r.id, day: r.day, ts: r.ts, durationMin: r.durationMin, exercises: r.exercises as StrengthSession["exercises"] }));
}

// ── Shared ──────────────────────────────────────────────────────────────────

export const BODY_LOG_TABLES = { bp: bpReadings, lab: labResults, strength: strengthSessions } as const;
export type BodyLogKind = keyof typeof BODY_LOG_TABLES;

export async function deleteBodyLog(db: Db, userId: number, kind: BodyLogKind, id: string): Promise<boolean> {
  const t = BODY_LOG_TABLES[kind];
  const res = await db.delete(t).where(and(eq(t.userId, userId), eq(t.id, id))).returning({ id: t.id });
  return res.length > 0;
}

/** The latest weight logged in Pulse or synced from a scale, for bodyweight exercises; null without one. */
export async function latestWeightKg(db: Db, userId: number): Promise<number | null> {
  const [row] = await db
    .select({ data: loggedEntries.data })
    .from(loggedEntries)
    .where(and(eq(loggedEntries.userId, userId), eq(loggedEntries.type, "weight")))
    .orderBy(desc(loggedEntries.ts))
    .limit(1);
  const kg = (row?.data as { kg?: number } | undefined)?.kg;
  return typeof kg === "number" ? kg : null;
}
