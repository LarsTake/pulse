// Lab results the user enters from a blood test. Pure: no I/O.
// Default ranges are common adult reference ranges; every lab prints its own, and a range typed in with the result
// wins over these. Pulse only says "below / within / above range", never what it means medically.
import { t as tr } from "@/lib/i18n";

export type LabSex = "male" | "female" | null;

export type LabMarker = {
  key: string;
  label: string;
  unit: string;
  group: "lipids" | "metabolic" | "blood" | "iron" | "vitamins" | "inflammation" | "hormones" | "kidney_liver";
  /** Default reference range [low, high]; null on one side means no limit there. By sex where it differs. */
  range: (sex: LabSex) => [number | null, number | null];
  /** Decimals to show. */
  dp: number;
};

const same = (lo: number | null, hi: number | null) => () => [lo, hi] as [number | null, number | null];
const bySex = (m: [number | null, number | null], f: [number | null, number | null]) => (s: LabSex) => (s === "female" ? f : m);

export const LAB_MARKERS: LabMarker[] = [
  { key: "ldl", label: tr("LDL cholesterol"), unit: "mg/dL", group: "lipids", range: same(null, 116), dp: 0 },
  { key: "hdl", label: tr("HDL cholesterol"), unit: "mg/dL", group: "lipids", range: bySex([40, null], [50, null]), dp: 0 },
  { key: "total_chol", label: tr("Total cholesterol"), unit: "mg/dL", group: "lipids", range: same(null, 200), dp: 0 },
  { key: "triglycerides", label: tr("Triglycerides"), unit: "mg/dL", group: "lipids", range: same(null, 150), dp: 0 },
  { key: "apob", label: tr("ApoB"), unit: "mg/dL", group: "lipids", range: same(null, 100), dp: 0 },
  { key: "lpa", label: tr("Lipoprotein(a)"), unit: "nmol/L", group: "lipids", range: same(null, 75), dp: 0 },
  { key: "glucose", label: tr("Fasting glucose"), unit: "mg/dL", group: "metabolic", range: same(70, 99), dp: 0 },
  { key: "hba1c", label: tr("HbA1c"), unit: "%", group: "metabolic", range: same(null, 5.6), dp: 1 },
  { key: "insulin", label: tr("Fasting insulin"), unit: "µU/mL", group: "metabolic", range: same(2, 25), dp: 1 },
  { key: "hemoglobin", label: tr("Hemoglobin"), unit: "g/dL", group: "blood", range: bySex([13.5, 17.5], [12, 15.5]), dp: 1 },
  { key: "hematocrit", label: tr("Hematocrit"), unit: "%", group: "blood", range: bySex([40, 52], [36, 46]), dp: 0 },
  { key: "wbc", label: tr("White blood cells"), unit: "/nL", group: "blood", range: same(4, 10), dp: 1 },
  { key: "platelets", label: tr("Platelets"), unit: "/nL", group: "blood", range: same(150, 400), dp: 0 },
  { key: "ferritin", label: tr("Ferritin"), unit: "ng/mL", group: "iron", range: bySex([30, 400], [15, 150]), dp: 0 },
  { key: "iron", label: tr("Iron"), unit: "µg/dL", group: "iron", range: same(60, 170), dp: 0 },
  { key: "vitd", label: tr("Vitamin D (25-OH)"), unit: "ng/mL", group: "vitamins", range: same(30, 100), dp: 0 },
  { key: "b12", label: tr("Vitamin B12"), unit: "pg/mL", group: "vitamins", range: same(200, 900), dp: 0 },
  { key: "folate", label: tr("Folate"), unit: "ng/mL", group: "vitamins", range: same(4, null), dp: 1 },
  { key: "magnesium", label: tr("Magnesium"), unit: "mmol/L", group: "vitamins", range: same(0.75, 1.05), dp: 2 },
  { key: "crp", label: tr("hs-CRP"), unit: "mg/L", group: "inflammation", range: same(null, 3), dp: 1 },
  { key: "tsh", label: tr("TSH"), unit: "mU/L", group: "hormones", range: same(0.4, 4), dp: 2 },
  { key: "testosterone", label: tr("Testosterone"), unit: "ng/dL", group: "hormones", range: bySex([264, 916], [15, 70]), dp: 0 },
  { key: "cortisol", label: tr("Cortisol (morning)"), unit: "µg/dL", group: "hormones", range: same(6, 23), dp: 1 },
  { key: "creatinine", label: tr("Creatinine"), unit: "mg/dL", group: "kidney_liver", range: bySex([0.7, 1.3], [0.5, 1.1]), dp: 2 },
  { key: "egfr", label: tr("eGFR"), unit: "mL/min/1.73m²", group: "kidney_liver", range: same(90, null), dp: 0 },
  { key: "alt", label: tr("ALT (GPT)"), unit: "U/L", group: "kidney_liver", range: bySex([null, 50], [null, 35]), dp: 0 },
  { key: "ggt", label: "GGT", unit: "U/L", group: "kidney_liver", range: bySex([null, 60], [null, 40]), dp: 0 },
  { key: "uric_acid", label: tr("Uric acid"), unit: "mg/dL", group: "kidney_liver", range: bySex([3.4, 7], [2.4, 6]), dp: 1 },
];

export const LAB_GROUP_LABEL: Record<LabMarker["group"], string> = {
  lipids: tr("Lipids"),
  metabolic: tr("Metabolic"),
  blood: tr("Blood count"),
  iron: tr("Iron"),
  vitamins: tr("Vitamins & minerals"),
  inflammation: tr("Inflammation"),
  hormones: tr("Hormones"),
  kidney_liver: tr("Kidney & liver"),
};

const BY_KEY = new Map(LAB_MARKERS.map((m) => [m.key, m]));
export const labMarker = (key: string) => BY_KEY.get(key) ?? null;

export type LabStatus = "low" | "in_range" | "high" | "no_range";

/** Where `value` falls against [low, high]; a missing side has no limit. */
export function labStatus(value: number, low: number | null, high: number | null): LabStatus {
  if (low === null && high === null) return "no_range";
  if (low !== null && value < low) return "low";
  if (high !== null && value > high) return "high";
  return "in_range";
}

export type LabResult = { marker: string; day: string; value: number; refLow: number | null; refHigh: number | null };

export type LabLatest = {
  marker: LabMarker;
  value: number;
  day: string;
  range: [number | null, number | null];
  status: LabStatus;
  /** The result before this one, for "up / down since last test". */
  previous: { value: number; day: string } | null;
};

/** The latest result per marker, in catalogue order. The lab's own range, when typed in, beats the default. */
export function latestLabs(results: LabResult[], sex: LabSex): LabLatest[] {
  const byMarker = new Map<string, LabResult[]>();
  for (const r of results) {
    if (!BY_KEY.has(r.marker)) continue;
    byMarker.set(r.marker, [...(byMarker.get(r.marker) ?? []), r]);
  }
  const out: LabLatest[] = [];
  for (const m of LAB_MARKERS) {
    const rs = byMarker.get(m.key);
    if (!rs?.length) continue;
    rs.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
    const [last, prev] = rs;
    const own = last.refLow !== null || last.refHigh !== null;
    const range: [number | null, number | null] = own ? [last.refLow, last.refHigh] : m.range(sex);
    out.push({ marker: m, value: last.value, day: last.day, range, status: labStatus(last.value, range[0], range[1]), previous: prev ? { value: prev.value, day: prev.day } : null });
  }
  return out;
}
