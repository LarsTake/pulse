import { beforeEach, describe, expect, it } from "vitest";
import { AppleBatch, ingestAppleHealth } from "./appleHealth";
import type { Db } from "./db";
import { bpReadings, loggedEntries } from "./db/schema";
import { entriesOnDay } from "./log";
import { freshDb, USER } from "./testing";

const TZ = "Europe/Berlin";
const NOW = Date.parse("2026-11-13T18:00:00Z") / 1000;
const T = NOW - 3600; // 18:00 local
const U1 = "6F1A2B3C-0000-4000-8000-000000000001";
const U2 = "6F1A2B3C-0000-4000-8000-000000000002";
const U3 = "6F1A2B3C-0000-4000-8000-000000000003";

let db: Db;
beforeEach(async () => {
  db = await freshDb();
});

const ingest = (b: AppleBatch) =>
  ingestAppleHealth(db, USER, AppleBatch.parse(b), TZ, NOW);

describe("ingestAppleHealth", () => {
  it("stores blood pressure, weight, body fat and water, and a resent sample updates its row", async () => {
    const r = await ingest({
      samples: [
        {
          kind: "bp",
          id: U1,
          ts: T,
          systolic: 128.4,
          diastolic: 81.6,
          pulse: 64,
        },
        { kind: "weight", id: U2, ts: T, value: 76.94 },
        { kind: "bodyFat", id: U3, ts: T, value: 18.25 },
      ],
    });
    expect(r).toEqual({ written: 3, deleted: 0 });
    expect(await db.select().from(bpReadings)).toMatchObject([
      {
        id: `ah-${U1.toLowerCase()}`,
        day: "2026-11-13",
        systolic: 128,
        diastolic: 82,
        pulse: 64,
      },
    ]);
    const rows = await db
      .select()
      .from(loggedEntries)
      .orderBy(loggedEntries.type);
    expect(rows.map((x) => [x.type, x.data, x.source, x.app])).toEqual([
      ["body-fat", { pct: 18.3 }, "apple", "APPLE_HEALTH"],
      ["weight", { kg: 76.9 }, "apple", "APPLE_HEALTH"],
    ]);

    await ingest({ samples: [{ kind: "weight", id: U2, ts: T, value: 77.2 }] });
    expect(
      (await db.select().from(loggedEntries)).find((x) => x.type === "weight")
        ?.data,
    ).toEqual({ kg: 77.2 });
  });

  it("shows Apple Health entries in the journal as another app's", async () => {
    await ingest({ samples: [{ kind: "water", id: U1, ts: T, value: 330 }] });
    const day = await entriesOnDay(db, USER, "2026-11-13");
    expect(day).toMatchObject([
      {
        type: "hydration-log",
        fromApp: true,
        app: "Apple Health",
        detail: "330 ml",
      },
    ]);
  });

  it("deletes what was deleted in Apple Health, and only that", async () => {
    await ingest({
      samples: [
        { kind: "bp", id: U1, ts: T, systolic: 120, diastolic: 80 },
        { kind: "water", id: U2, ts: T, value: 250 },
      ],
    });
    await db
      .insert(loggedEntries)
      .values({
        userId: USER,
        id: U3.toLowerCase(),
        type: "hydration-log",
        ts: T,
        day: "2026-11-13",
        data: { ml: 500 },
        createdAt: NOW,
      });
    const r = await ingest({ deleted: [U1, U2, U3] });
    expect(r).toEqual({ written: 0, deleted: 2 });
    expect(await db.select().from(bpReadings)).toEqual([]);
    expect((await db.select().from(loggedEntries)).map((x) => x.id)).toEqual([
      U3.toLowerCase(),
    ]);
  });

  it("skips samples from the future and rejects implausible values", async () => {
    expect(
      await ingest({
        samples: [{ kind: "weight", id: U1, ts: NOW + 3600, value: 80 }],
      }),
    ).toEqual({ written: 0, deleted: 0 });
    // One bad sample is dropped; the rest of the batch still goes in.
    const batch = AppleBatch.parse({
      samples: [
        { kind: "bp", id: U1, ts: T, systolic: 400, diastolic: 80 },
        { kind: "weight", id: "x", ts: T, value: 80 },
        { kind: "weight", id: U2, ts: T, value: 80 },
      ],
    });
    expect(batch.samples.map((x) => x.id)).toEqual([U2]);
    expect(AppleBatch.safeParse({ deleted: ["not-a-uuid"] }).success).toBe(
      false,
    );
  });
});
