// Blood pressure from readings the user logs by hand (an upper-arm cuff). Pure: no I/O.
// Categories follow the 2017 ACC/AHA guideline (Whelton et al., Hypertension 2018;71:e13). Each reading is
// classed by the worse of its two numbers; an average uses the same cut points on the mean.

export type BpReading = { ts: number; systolic: number; diastolic: number; pulse: number | null };

export type BpCategory = "normal" | "elevated" | "stage1" | "stage2" | "crisis";

export const BP_CATEGORY_LABEL: Record<BpCategory, string> = {
  normal: "Normal",
  elevated: "Elevated",
  stage1: "High, stage 1",
  stage2: "High, stage 2",
  crisis: "Very high",
};

/** The ACC/AHA category of one reading or an average. */
export function bpCategory(systolic: number, diastolic: number): BpCategory {
  if (systolic > 180 || diastolic > 120) return "crisis";
  if (systolic >= 140 || diastolic >= 90) return "stage2";
  if (systolic >= 130 || diastolic >= 80) return "stage1";
  if (systolic >= 120) return "elevated";
  return "normal";
}

export type BpSummary = {
  /** Mean of the readings in the window, rounded to whole mmHg. */
  systolic: number;
  diastolic: number;
  pulse: number | null;
  count: number;
  category: BpCategory;
};

/** The mean of the readings with `from <= ts < to`; null without any. */
export function bpSummary(readings: BpReading[], from: number, to: number): BpSummary | null {
  const xs = readings.filter((r) => r.ts >= from && r.ts < to);
  if (!xs.length) return null;
  const mean = (f: (r: BpReading) => number) => xs.reduce((s, r) => s + f(r), 0) / xs.length;
  const systolic = Math.round(mean((r) => r.systolic));
  const diastolic = Math.round(mean((r) => r.diastolic));
  const withPulse = xs.filter((r) => r.pulse !== null);
  const pulse = withPulse.length ? Math.round(withPulse.reduce((s, r) => s + r.pulse!, 0) / withPulse.length) : null;
  return { systolic, diastolic, pulse, count: xs.length, category: bpCategory(systolic, diastolic) };
}

/**
 * Change of the 7-day mean against the 7 days before it, in mmHg, or null when either week has fewer than 2 readings
 * (one cuff reading swings by 5–10 mmHg on its own).
 */
export function bpWeekDelta(readings: BpReading[], now: number): { systolic: number; diastolic: number } | null {
  const week = 7 * 86_400;
  const a = readings.filter((r) => r.ts >= now - week && r.ts <= now);
  const b = readings.filter((r) => r.ts >= now - 2 * week && r.ts < now - week);
  if (a.length < 2 || b.length < 2) return null;
  const m = (xs: BpReading[], f: (r: BpReading) => number) => xs.reduce((s, r) => s + f(r), 0) / xs.length;
  return {
    systolic: Math.round(m(a, (r) => r.systolic) - m(b, (r) => r.systolic)),
    diastolic: Math.round(m(a, (r) => r.diastolic) - m(b, (r) => r.diastolic)),
  };
}

/** Plausible cuff values; anything outside is a typo, not a reading. */
export const BP_LIMITS = { systolic: [60, 260], diastolic: [30, 160], pulse: [25, 220] } as const;
