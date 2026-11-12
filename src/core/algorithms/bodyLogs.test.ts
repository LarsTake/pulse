import { describe, expect, it } from "vitest";
import { bpCategory, bpSummary, bpWeekDelta, type BpReading } from "./bloodPressure";
import { labStatus, latestLabs } from "./labs";
import { bestsAndPrs, e1rm, muscularLoad, setsPerMuscle, tonnage, volumeStatus, type StrengthSession } from "./strength";

describe("bpCategory (ACC/AHA 2017)", () => {
  it.each([
    [115, 75, "normal"],
    [125, 75, "elevated"],
    [125, 82, "stage1"],
    [135, 70, "stage1"],
    [142, 85, "stage2"],
    [120, 92, "stage2"],
    [185, 100, "crisis"],
    [150, 125, "crisis"],
  ] as const)("%i/%i is %s", (s, d, c) => expect(bpCategory(s, d)).toBe(c));
});

const r = (day: number, s: number, d: number, pulse: number | null = null): BpReading => ({ ts: day * 86_400, systolic: s, diastolic: d, pulse });

describe("bpSummary", () => {
  it("averages the window and classes the mean", () => {
    const xs = [r(1, 118, 76, 60), r(2, 124, 80, null), r(3, 130, 84, 70), r(9, 160, 100)];
    expect(bpSummary(xs, 0, 5 * 86_400)).toEqual({ systolic: 124, diastolic: 80, pulse: 65, count: 3, category: "stage1" });
  });
  it("is null with no readings", () => expect(bpSummary([], 0, 1)).toBeNull());
});

describe("bpWeekDelta", () => {
  const now = 20 * 86_400;
  it("compares this week with last", () => {
    const xs = [r(7, 130, 85), r(8, 132, 87), r(15, 124, 80), r(16, 122, 78)];
    expect(bpWeekDelta(xs, now)).toEqual({ systolic: -8, diastolic: -7 });
  });
  it("needs two readings in each week", () => expect(bpWeekDelta([r(8, 130, 85), r(15, 124, 80), r(16, 122, 78)], now)).toBeNull());
});

describe("labs", () => {
  it("labStatus handles open-ended ranges", () => {
    expect(labStatus(150, null, 116)).toBe("high");
    expect(labStatus(45, 50, null)).toBe("low");
    expect(labStatus(5.4, null, 5.6)).toBe("in_range");
    expect(labStatus(1, null, null)).toBe("no_range");
  });
  it("latestLabs keeps the newest result, uses the lab's own range, and the sex-specific default", () => {
    const out = latestLabs(
      [
        { marker: "ferritin", day: "2026-01-10", value: 20, refLow: null, refHigh: null },
        { marker: "ferritin", day: "2026-06-10", value: 25, refLow: null, refHigh: null },
        { marker: "vitd", day: "2026-06-10", value: 28, refLow: 20, refHigh: 60 },
        { marker: "unknown", day: "2026-06-10", value: 1, refLow: null, refHigh: null },
      ],
      "male",
    );
    expect(out.map((x) => x.marker.key)).toEqual(["ferritin", "vitd"]);
    expect(out[0]).toMatchObject({ value: 25, status: "low", previous: { value: 20, day: "2026-01-10" } });
    expect(out[1]).toMatchObject({ range: [20, 60], status: "in_range" });
    expect(latestLabs([{ marker: "ferritin", day: "2026-06-10", value: 25, refLow: null, refHigh: null }], "female")[0].status).toBe("in_range");
  });
});

const session = (day: string, exercises: StrengthSession["exercises"]): StrengthSession => ({ id: day, day, ts: 0, durationMin: null, exercises });

describe("strength", () => {
  it("e1rm follows Epley and stops past 12 reps", () => {
    expect(e1rm({ reps: 1, kg: 100 })).toBe(100);
    expect(e1rm({ reps: 5, kg: 100 })).toBeCloseTo(116.67, 2);
    expect(e1rm({ reps: 15, kg: 50 })).toBeNull();
    expect(e1rm({ reps: 5, kg: 0 })).toBeNull();
  });
  it("counts a secondary muscle half a set", () => {
    const s = setsPerMuscle([session("2026-11-10", [{ key: "bench_press", sets: [{ reps: 8, kg: 80 }, { reps: 8, kg: 80 }, { reps: 0, kg: 80 }] }])]);
    expect(s.chest).toBe(2);
    expect(s.triceps).toBe(1);
    expect(s.quads).toBe(0);
  });
  it("volumeStatus bands", () => {
    expect([0, 6, 10, 20, 24].map(volumeStatus)).toEqual(["none", "low", "optimal", "optimal", "high"]);
  });
  it("tonnage counts bodyweight work", () => {
    expect(tonnage(session("d", [{ key: "squat", sets: [{ reps: 5, kg: 100 }] }, { key: "pull_up", sets: [{ reps: 10, kg: 0 }] }]), 80)).toBe(500 + 520);
  });
  it("muscularLoad rises with sets and saturates below 21", () => {
    const sets = (n: number) => session("d", [{ key: "squat", sets: Array.from({ length: n }, () => ({ reps: 5, kg: 100 })) }]);
    const a = muscularLoad(sets(5));
    const b = muscularLoad(sets(20));
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(muscularLoad(sets(200))).toBeLessThanOrEqual(21);
    // Light sets against a known best count less.
    expect(muscularLoad(sets(10), new Map([["squat", 200]]))).toBeLessThan(muscularLoad(sets(10)));
  });
  it("finds PRs against earlier bests only", () => {
    const old = session("2026-11-01", [{ key: "squat", sets: [{ reps: 5, kg: 100 }] }]);
    const now = session("2026-11-08", [{ key: "squat", sets: [{ reps: 5, kg: 105 }] }, { key: "curl", sets: [{ reps: 10, kg: 15 }] }]);
    const { prs } = bestsAndPrs([old], now);
    expect(prs.map((p) => p.key)).toEqual(["squat"]);
    expect(prs[0].e1rm).toBe(122.5);
  });
});
