// The journal's behaviour catalogue (journal-behavior-picker-*): every behaviour a person can add to the daily journal, with the
// sentence the journal asks, its Select Behaviors category and the journal section it sits in. Keys are stored in
// journal_tags and journal_entries; never rename one. The nine defaults keep their original keys.
import { t as tr } from "@/lib/i18n";

export const BEHAVIOR_CATEGORIES = [
  { key: "drugs", label: tr("Drugs & medication") },
  { key: "health", label: tr("Health & symptoms") },
  { key: "personal", label: tr("Personal health") },
  { key: "lifestyle", label: tr("Lifestyle") },
  { key: "mental", label: tr("Mental wellbeing") },
  { key: "nutrition", label: tr("Nutrition") },
  { key: "recovery", label: tr("Recovery") },
] as const
export type BehaviorCategory = (typeof BEHAVIOR_CATEGORIES)[number]["key"]

/** The journal's sections (journal-daily-questions-today): when in the day the question is about. Custom behaviours sit under "custom". */
export const JOURNAL_SECTIONS = [
  { key: "daytime", title: tr("Daytime") },
  { key: "nighttime", title: tr("Nighttime") },
  { key: "status", title: tr("Status") },
  { key: "custom", title: tr("Your behaviours") },
] as const
export type JournalSection = (typeof JOURNAL_SECTIONS)[number]["key"]

/**
 * A follow-up asked once the answer is yes (journal-follow-up-slider-open): a slider whose value is stored beside the answer.
 * "clock" is minutes after midnight in 30-minute steps; "count" a whole number.
 */
export type FollowUp = { question: string; kind: "clock" | "count"; min: number; max: number; step: number }

export type Behavior = { key: string; label: string; question: string; category: BehaviorCategory; section: Exclude<JournalSection, "custom">; followUp?: FollowUp }

const LAST: FollowUp = { question: tr("When did you last consume it?"), kind: "clock", min: 6 * 60, max: 24 * 60 - 30, step: 30 }

export const BEHAVIORS: readonly Behavior[] = [
  { key: "accutane", label: tr("Accutane"), question: tr("Took Accutane?"), category: "drugs", section: "daytime" },
  { key: "acne", label: tr("Acne"), question: tr("Experienced acne?"), category: "health", section: "status" },
  { key: "acupuncture", label: tr("Acupuncture"), question: tr("Received acupuncture therapy?"), category: "recovery", section: "daytime" },
  { key: "adhd_medication", label: tr("AD(H)D medication"), question: tr("Took AD(H)D medication?"), category: "drugs", section: "daytime" },
  { key: "adaptogens", label: tr("Adaptogen mushrooms"), question: tr("Took adaptogen mushrooms?"), category: "nutrition", section: "daytime" },
  { key: "added_sugar", label: tr("Added sugar"), question: tr("Consumed added sugar?"), category: "nutrition", section: "daytime" },
  { key: "afternoon_snack", label: tr("Afternoon snack"), question: tr("Ate an afternoon snack?"), category: "nutrition", section: "daytime" },
  { key: "air_travel", label: tr("Air travel"), question: tr("Travelled by plane?"), category: "lifestyle", section: "daytime" },
  { key: "alcohol", label: tr("Alcohol"), question: tr("Had any alcohol?"), category: "nutrition", section: "nighttime", followUp: { question: tr("How many drinks?"), kind: "count", min: 1, max: 10, step: 1 } },
  { key: "allergy_medication", label: tr("Allergy medication"), question: tr("Took allergy medication?"), category: "drugs", section: "daytime" },
  { key: "anti_anxiety_medication", label: tr("Anti-anxiety medication"), question: tr("Took anti-anxiety medication?"), category: "drugs", section: "daytime" },
  { key: "anxiety", label: tr("Anxiety"), question: tr("Felt anxious?"), category: "mental", section: "status" },
  { key: "blood_donation", label: tr("Blood donation"), question: tr("Donated blood?"), category: "personal", section: "daytime" },
  { key: "caffeine", label: tr("Caffeine"), question: tr("Had any caffeine?"), category: "nutrition", section: "daytime", followUp: LAST },
  { key: "camping", label: tr("Camping"), question: tr("Went camping?"), category: "lifestyle", section: "nighttime" },
  { key: "car_train_travel", label: tr("Car or train travel"), question: tr("Travelled by car or train?"), category: "lifestyle", section: "daytime" },
  { key: "caregiving", label: tr("Caregiving"), question: tr("Cared for someone?"), category: "lifestyle", section: "daytime" },
  { key: "cold_exposure", label: tr("Cold exposure"), question: tr("Took a cold plunge or shower?"), category: "recovery", section: "daytime" },
  { key: "electrolytes", label: tr("Electrolytes"), question: tr("Took electrolyte supplements?"), category: "nutrition", section: "daytime", followUp: LAST },
  { key: "family_friends", label: tr("Family and friends"), question: tr("Spent time with family or friends?"), category: "mental", section: "daytime" },
  { key: "feeding_baby", label: tr("Feeding baby at night"), question: tr("Fed a baby at night?"), category: "lifestyle", section: "nighttime" },
  { key: "fever", label: tr("Fever"), question: tr("Experiencing a fever?"), category: "health", section: "daytime" },
  { key: "headache", label: tr("Headache"), question: tr("Had a headache?"), category: "health", section: "status" },
  { key: "illness", label: tr("Illness"), question: tr("Feeling sick or ill?"), category: "health", section: "status" },
  { key: "injury", label: tr("Injury"), question: tr("Dealing with an injury?"), category: "health", section: "status" },
  { key: "intermittent_fasting", label: tr("Intermittent fasting"), question: tr("Fasted for 14 hours or more?"), category: "nutrition", section: "daytime" },
  { key: "journaling", label: tr("Journaling"), question: tr("Wrote in a journal?"), category: "mental", section: "nighttime" },
  { key: "late_caffeine", label: tr("Late caffeine"), question: tr("Had caffeine after 2 PM?"), category: "nutrition", section: "daytime" },
  { key: "late_meal", label: tr("Late meal"), question: tr("Ate within two hours of bed?"), category: "nutrition", section: "nighttime" },
  { key: "magnesium", label: tr("Magnesium"), question: tr("Took magnesium?"), category: "nutrition", section: "nighttime" },
  { key: "meditation", label: tr("Meditation"), question: tr("Meditated?"), category: "mental", section: "daytime" },
  { key: "melatonin", label: tr("Melatonin"), question: tr("Took melatonin?"), category: "drugs", section: "nighttime" },
  { key: "menstruating", label: tr("Menstruating"), question: tr("Menstruating?"), category: "personal", section: "status" },
  { key: "mouth_tape", label: tr("Mouth tape"), question: tr("Wore mouth tape while sleeping?"), category: "recovery", section: "nighttime" },
  { key: "nap", label: tr("Nap"), question: tr("Took a nap?"), category: "recovery", section: "daytime" },
  { key: "night_shift", label: tr("Night shift"), question: tr("Worked the night shift?"), category: "lifestyle", section: "nighttime" },
  { key: "on_call", label: tr("On-call shift"), question: tr("Worked an on-call shift?"), category: "lifestyle", section: "nighttime" },
  { key: "outdoor_time", label: tr("Outdoor time"), question: tr("Spent time outdoors?"), category: "lifestyle", section: "daytime" },
  { key: "parenting", label: tr("Parenting"), question: tr("Spent the day parenting?"), category: "lifestyle", section: "daytime" },
  { key: "remote_work", label: tr("Remote work"), question: tr("Worked from home?"), category: "lifestyle", section: "daytime" },
  { key: "sauna", label: tr("Sauna"), question: tr("Used a sauna?"), category: "recovery", section: "daytime" },
  { key: "screen_in_bed", label: tr("Screen in bed"), question: tr("Used a screen in bed?"), category: "lifestyle", section: "nighttime" },
  { key: "sexual_activity", label: tr("Sexual activity"), question: tr("Had sexual activity?"), category: "personal", section: "nighttime" },
  { key: "shared_bed_child", label: tr("Shared bedroom with child"), question: tr("Shared a bedroom with a child?"), category: "lifestyle", section: "nighttime" },
  { key: "sleep_aid", label: tr("Sleep aid"), question: tr("Took a sleep aid?"), category: "drugs", section: "nighttime" },
  { key: "sore_throat", label: tr("Sore throat"), question: tr("Have a sore throat?"), category: "health", section: "status" },
  { key: "stress", label: tr("Stress"), question: tr("Felt stressed?"), category: "mental", section: "status" },
  { key: "stretching", label: tr("Stretching"), question: tr("Stretched?"), category: "recovery", section: "daytime" },
  { key: "therapy", label: tr("Therapy"), question: tr("Went to a therapy session?"), category: "mental", section: "daytime" },
  { key: "travel", label: tr("Travel"), question: tr("Travelled today?"), category: "lifestyle", section: "status" },
]

const BY_KEY = new Map(BEHAVIORS.map((b) => [b.key, b]))
export const behavior = (key: string): Behavior | undefined => BY_KEY.get(key)

/** The journal's question for a tag: the catalogue sentence, or a custom label as a question. */
export const questionOf = (tag: string, label: string) => behavior(tag)?.question ?? `${label}?`

/** A follow-up value as words: "3:30 PM" or "3". */
export function followUpText(f: FollowUp, v: number) {
  if (f.kind === "count") return String(v)
  const h = Math.floor(v / 60) % 24
  return `${h % 12 || 12}:${String(v % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`
}
