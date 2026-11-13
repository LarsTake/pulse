// Apple Health, read on the iPhone by the iOS app (mobile/ios/App/App/HealthSync.swift) and posted here. Kept in
// Pulse only, never written to Google: blood pressure goes to bp_readings, weight, body fat and water to
// logged_entries as another app's entries (source `apple`). Ids are HealthKit's sample UUIDs with an `ah-` prefix,
// so a resent sample updates its row and a sample deleted in Apple Health is deleted here too.
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { BP_LIMITS } from "@/core/algorithms/bloodPressure";
import type { Db } from "./db";
import { bpReadings, loggedEntries } from "./db/schema";
import { localDay } from "./time";

export const APPLE_SOURCE = "apple";
export const APPLE_APP = "APPLE_HEALTH";
const PREFIX = "ah-";

const Id = z.string().regex(/^[0-9A-Fa-f-]{36}$/);
/** Epoch seconds; Apple Health goes back years, the future is a clock error. */
const Ts = z.number().int().min(946_684_800);

const Sample = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("bp"),
    id: Id,
    ts: Ts,
    systolic: z.number().min(BP_LIMITS.systolic[0]).max(BP_LIMITS.systolic[1]),
    diastolic: z
      .number()
      .min(BP_LIMITS.diastolic[0])
      .max(BP_LIMITS.diastolic[1]),
    pulse: z
      .number()
      .min(BP_LIMITS.pulse[0])
      .max(BP_LIMITS.pulse[1])
      .nullable()
      .optional(),
  }),
  z.object({
    kind: z.literal("weight"),
    id: Id,
    ts: Ts,
    value: z.number().min(20).max(400),
  }),
  z.object({
    kind: z.literal("bodyFat"),
    id: Id,
    ts: Ts,
    value: z.number().min(2).max(75),
  }),
  z.object({
    kind: z.literal("water"),
    id: Id,
    ts: Ts,
    value: z.number().min(1).max(10_000),
  }),
]);
export type AppleSample = z.infer<typeof Sample>;

/** One request's worth. A sample that doesn't parse (an implausible reading, a typo in Apple Health) is dropped on its own. */
export const AppleBatch = z.object({
  samples: z
    .array(z.unknown())
    .max(1000)
    .default([])
    .transform((xs) =>
      xs.flatMap((x) => {
        const r = Sample.safeParse(x);
        return r.success ? [r.data] : [];
      }),
    ),
  deleted: z.array(Id).max(1000).default([]),
});
export type AppleBatch = z.input<typeof AppleBatch>;

const ENTRY_TYPE = {
  weight: "weight",
  bodyFat: "body-fat",
  water: "hydration-log",
} as const;
const entryData = (s: Exclude<AppleSample, { kind: "bp" }>) =>
  s.kind === "weight"
    ? { kg: Math.round(s.value * 10) / 10 }
    : s.kind === "bodyFat"
      ? { pct: Math.round(s.value * 10) / 10 }
      : { ml: Math.round(s.value) };

/**
 * Stores one batch for `userId`. Samples dated in the future (beyond a minute) are skipped. Returns how many rows
 * were written and deleted.
 */
export async function ingestAppleHealth(
  db: Db,
  userId: number,
  batch: z.output<typeof AppleBatch>,
  tz: string,
  now: number,
): Promise<{ written: number; deleted: number }> {
  let written = 0;
  for (const s of batch.samples) {
    if (s.ts > now + 60) continue;
    const id = PREFIX + s.id.toLowerCase();
    const day = localDay(s.ts, tz);
    if (s.kind === "bp") {
      const row = {
        ts: s.ts,
        day,
        systolic: Math.round(s.systolic),
        diastolic: Math.round(s.diastolic),
        pulse: s.pulse == null ? null : Math.round(s.pulse),
      };
      await db
        .insert(bpReadings)
        .values({ userId, id, ...row, createdAt: now })
        .onConflictDoUpdate({
          target: [bpReadings.userId, bpReadings.id],
          set: row,
        });
    } else {
      const row = {
        type: ENTRY_TYPE[s.kind],
        ts: s.ts,
        day,
        data: entryData(s),
        source: APPLE_SOURCE,
        app: APPLE_APP,
      };
      await db
        .insert(loggedEntries)
        .values({ userId, id, ...row, createdAt: now })
        .onConflictDoUpdate({
          target: [loggedEntries.userId, loggedEntries.id],
          set: row,
        });
    }
    written++;
  }
  let deleted = 0;
  if (batch.deleted.length) {
    const ids = batch.deleted.map((d) => PREFIX + d.toLowerCase());
    const bp = await db
      .delete(bpReadings)
      .where(and(eq(bpReadings.userId, userId), inArray(bpReadings.id, ids)))
      .returning({ id: bpReadings.id });
    const le = await db
      .delete(loggedEntries)
      .where(
        and(
          eq(loggedEntries.userId, userId),
          eq(loggedEntries.source, APPLE_SOURCE),
          inArray(loggedEntries.id, ids),
        ),
      )
      .returning({ id: loggedEntries.id });
    deleted = bp.length + le.length;
  }
  return { written, deleted };
}
