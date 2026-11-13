
import { t as tr } from "@/lib/i18n"// "How Pulse works" (More): one explainer per score, written from src/core and docs/algorithms. Every number here
// is the code's; when the code changes, change this file.
export type HowRow = { term: string; detail: string }
export type HowSection = { title: string; paragraphs?: string[]; rows?: HowRow[] }
export type ScoreDoc = {
  /** URL segment: /more/how-it-works/<slug>. */
  slug: string
  /** Display name, e.g. "Recovery", "Pulse Age". */
  name: string
  /** One short sentence (max ~70 characters) shown as the page intro and as a caption. */
  summary: string
  /** The in-app screen where the score lives, e.g. "/recovery", "/health/healthspan"; null if none. */
  href: string | null
  /** In this order: "What goes in", "How it is weighted", "What the bands mean", optionally "A worked example" (real numbers run through the code), "Limits". Omit a section only if it truly does not apply (say so in Limits instead). */
  sections: HowSection[]
}
export const SCORE_DOCS: ScoreDoc[] = [
  {
    slug: "recovery",
    name: "Recovery",
    summary: tr("How ready your body is to take on strain today, from 0 to 100%."),
    href: "/recovery",
    sections: [
      {
        title: tr("What goes in"),
        paragraphs: [
          "Pulse scores Recovery each morning from last night’s main sleep, comparing each vital with your own baseline: a running average of recent nights that leans on the last two weeks and clips extreme nights.",
        ],
        rows: [
          { term: "Heart rate variability", detail: tr("Fitbit’s nightly HRV, in ms. Higher is better.") },
          { term: "Resting heart rate", detail: tr("Fitbit’s daily resting heart rate from Google, in bpm; the lowest 5-minute average during sleep only on a day Google has none. Lower is better.") },
          { term: "Sleep performance", detail: tr("Last night’s Sleep Performance. 85% is neutral.") },
          { term: "Respiratory rate", detail: tr("Breaths per minute asleep, in rpm. Higher counts against you.") },
          { term: "Skin temperature", detail: tr("Distance from Google’s skin-temperature baseline (your 30-night median), in °C; Pulse’s own baseline only when Google gives none. Either direction counts against you.") },
        ],
      },
      {
        title: tr("How it is weighted"),
        paragraphs: [
          "Each input is measured in units of your usual night-to-night swing from baseline. Sleep moves one unit per 12\u00a0points away from 85%, skin temperature one unit per 1\u00a0°C. A missing input’s weight is shared among the rest.",
        ],
        rows: [
          { term: "HRV", detail: "55%" },
          { term: "Resting heart rate", detail: "20%" },
          { term: "Sleep performance", detail: "15%" },
          { term: "Respiratory rate", detail: "5%" },
          { term: "Skin temperature", detail: "5%" },
        ],
      },
      {
        title: tr("What the bands mean"),
        paragraphs: [
          "The weighted average goes through an S-shaped curve (slope 1.6). Every input at baseline lands at about 58%; a quarter of a swing above reaches green, 0.6 below drops into red.",
        ],
        rows: [
          { term: "67-100%", detail: tr("Green: your body is primed for strain.") },
          { term: "34-66%", detail: tr("Yellow: you are maintaining; moderate strain fits.") },
          { term: "0-33%", detail: tr("Red: your body needs rest.") },
        ],
      },
      {
        title: tr("Limits"),
        paragraphs: [
          "Recovery needs 7\u00a0nights of HRV before the first score and is Provisional until 14. The other vitals join once each has 4\u00a0nights of baseline. A night Fitbit could not stage has no HRV, so it gets no score rather than a guess, and after more than 14\u00a0nights without HRV the first night back is not scored. Recovery is an estimate from a wrist sensor: it reads your body, not your plans or how you feel.",
        ],
      },
    ],
  },
  {
    slug: "strain",
    name: "Strain",
    summary: tr("The cardiovascular load of your day, on a scale from 0 to 21."),
    href: "/strain",
    sections: [
      {
        title: tr("What goes in"),
        rows: [
          { term: "Heart rate", detail: tr("Every reading from local midnight to midnight, sleep included. Each reading covers the gap to the next one, up to 2 minutes.") },
          { term: "Resting heart rate", detail: tr("Fitbit’s daily value from Google, else last night’s sleeping resting heart rate, else 60 bpm.") },
          { term: "Max heart rate", detail: tr("The value in Settings; else 208 − 0.7 × your age.") },
        ],
      },
      {
        title: tr("How it is weighted"),
        paragraphs: [
          "Each minute earns points by how hard your heart works, as a share of your heart-rate reserve: the gap between your resting and max heart rate.",
        ],
        rows: [
          { term: "Below 50%", detail: tr("0 points a minute") },
          { term: "50-59%", detail: tr("1 point a minute") },
          { term: "60-69%", detail: tr("2 points a minute") },
          { term: "70-79%", detail: tr("3 points a minute") },
          { term: "80-89%", detail: tr("4 points a minute") },
          { term: "90% and up", detail: tr("5 points a minute") },
        ],
      },
      {
        title: tr("What the bands mean"),
        paragraphs: [
          "The day’s points go on a log scale: Strain = 21 × ln(points + 1) ÷ ln(7,201), where 7,201 is a whole day at 5\u00a0points a minute, plus one. An hour at 70-79% with nothing else gives about 12.3. Doubling your points adds only about 1.6, so each point of Strain is harder to earn than the last.",
        ],
        rows: [
          { term: "0-9.9", detail: tr("Light") },
          { term: "10.0-13.9", detail: tr("Moderate") },
          { term: "14.0-17.9", detail: tr("Strenuous") },
          { term: "18.0-21.0", detail: tr("All out") },
        ],
      },
      {
        title: tr("Limits"),
        paragraphs: [
          "Strain needs at least 600 heart-rate readings, or 20 spread over at least 10\u00a0minutes; otherwise the day shows Not enough data. Today’s Strain is a running total until midnight. Each activity also gets its own Strain from the heart rate during it.",
          "Heart rate misses effort that barely raises it, such as heavy lifting with long rests. The zone chart and Strain use the same five zones on your heart-rate reserve (max minus resting heart rate): Zone 1 starts at resting + 50% of the reserve, then 60, 70, 80 and 90%. Below Zone 1 is not counted as a zone.",
        ],
      },
    ],
  },
  {
    slug: "strain-target",
    name: "Strain Target",
    summary: tr("A Strain range for today, set by your Recovery and recent load."),
    href: "/strain",
    sections: [
      {
        title: tr("What goes in"),
        rows: [
          { term: "Today’s Recovery", detail: tr("Picks the band. Without a Recovery score there is no target.") },
          { term: "Your last 28\u00a0days of Strain", detail: tr("The average of the days with Strain, today not included, is your base.") },
          { term: "Training load (ACWR)", detail: tr("Your last 7 days of Strain against your last 28, up to yesterday.") },
        ],
      },
      {
        title: tr("How it is weighted"),
        rows: [
          { term: "Green Recovery", detail: tr("Base × 1.0 to base × 1.25") },
          { term: "Yellow Recovery", detail: tr("Base × 0.8 to base × 1.0") },
          { term: "Red Recovery", detail: tr("Base × 0.5 to base × 0.75") },
        ],
        paragraphs: [
          "If your training load is above 1.3, the top of the range is capped at your base, since load is already climbing fast. Below 0.8, both ends rise by 10%. The range is then kept between 4 and 19 and at least 2 wide; a range that is too narrow widens downwards. A base of 12 on a green day gives 12.0 - 15.0.",
        ],
      },
      {
        title: tr("What the bands mean"),
        rows: [
          { term: "Below the range", detail: tr("A lighter day than your body can take today.") },
          { term: "Inside the range", detail: tr("Training builds fitness without digging a recovery hole.") },
          { term: "Above the range", detail: tr("More strain than today’s Recovery suggests; expect it to show tomorrow.") },
        ],
      },
      {
        title: tr("A worked example"),
        paragraphs: [
          "Take 27 days of past Strain, oldest first: 10, 12, 0, 13, 11, 9, 14, then 11, 12, 0, 12, 10, 13, 12, then 10, 13, 0, 11, 12, 14, 9, then 12, 15, 13, 0, 16, 14. Today's own Strain is left out. The zeros are rest days with the band on, so they count.",
          "Their average is 10.30, so the base is 10.3. Training load, the last 7 days against the last 28, comes to 1.10. That sits between 0.8 and 1.3, so it neither caps nor lifts the range.",
          "Today's Recovery is 72%, which is green (67 and above). Green is base × 1.0 to base × 1.25, so the target is 10.3 to 12.9. With the same history and a Recovery of 50%, yellow applies (base × 0.8 to base × 1.0) and the target drops to 8.2 to 10.3.",
          "Both ranges sit inside the 4 to 19 limits and are more than 2 wide, so nothing is clamped. Aiming for 11 to 12 on the green day builds fitness without outrunning Recovery.",
        ],
      },
      {
        title: tr("Limits"),
        paragraphs: [
          "With fewer than 14\u00a0days of Strain in the last 28, Pulse uses a starting range for your band, marked as an estimate: green 14.0 - 18.0, yellow 10.0 - 14.0, red 6.0 - 10.0. The target does not know your training plan, races or injuries. It is a guide, not a prescription.",
        ],
      },
    ],
  },
  {
    slug: "sleep",
    name: "Sleep Performance",
    summary: tr("How well last night’s sleep met your need, from 0 to 100%."),
    href: "/sleep",
    sections: [
      {
        title: tr("What goes in"),
        rows: [
          { term: "Hours asleep", detail: tr("Your main sleep against your sleep need. Naps are not counted here.") },
          { term: "Sleep efficiency", detail: tr("Time asleep as a share of time in bed.") },
          { term: "Restorative sleep", detail: tr("Deep and REM sleep as a share of time asleep.") },
          { term: "Sleep consistency", detail: tr("Your Sleep Regularity over the last 7 days.") },
        ],
        paragraphs: [
          "Your sleep need is the upper quartile of your last 28\u00a0nights, at least 8\u00a0hours (9 under 18) and at most 9.5. Until you have 7\u00a0nights, it is 8\u00a0hours.",
        ],
      },
      {
        title: tr("How it is weighted"),
        rows: [
          { term: "Hours vs. need, 50%", detail: tr("Full marks at 100% of your need.") },
          { term: "Efficiency, 20%", detail: tr("Scored as the percentage itself.") },
          { term: "Restorative, 20%", detail: tr("Full marks when deep plus REM reach 50% of your sleep and deep alone reaches 13%. Less deep sleep scales this part down, to half at none.") },
          { term: "Consistency, 10%", detail: tr("Scored as the consistency percentage.") },
        ],
      },
      {
        title: tr("What the bands mean"),
        rows: [
          { term: "85-100%", detail: tr("Optimal") },
          { term: "70-84%", detail: tr("Sufficient") },
          { term: "0-69%", detail: tr("Poor") },
        ],
        paragraphs: [
          "The key statistics use their own marks for optimal and sufficient: hours vs. needed 85% and 70%, efficiency 85% and 75%, restorative 40% and 30%, consistency 80% and 70%.",
        ],
      },
      {
        title: tr("A worked example"),
        paragraphs: [
          "Take someone whose last 28 nights run from 6.8 to 8.8 hours. The upper quartile of those nights is 8.2 hours, above the 8-hour floor, so their sleep need is 8.2 hours. Last night they slept 6 hours 45 minutes, spent 88% of their time in bed asleep, got 55 minutes of deep and 85 minutes of REM sleep, and their Sleep Regularity over the last 7 days is 88.9%.",
          "Hours come first: 6.75 against 8.2 is 82.3% of need, worth 50% of the score, so 41.2 points. Efficiency is scored as the percentage itself, 88, and counts 20%, so 17.6 points. Restorative sleep is deep plus REM, 140 minutes out of 405, or 34.6% of the night. Against the 50% target that is 69.1, and since deep sleep is 13.6% of the night, above the 13% mark, nothing is scaled down. At 20% weight, that is 13.8 points. Consistency counts 10%, so 88.9 gives 8.9 points.",
          "Add them up: 41.2 + 17.6 + 13.8 + 8.9 comes to 81.5, shown as 81%. That sits in the Sufficient band (70-84%), just short of Optimal. The weakest part is hours: another 30 minutes in bed would have added about 3 points. The figures come from running Pulse's own scoring code on these inputs.",
        ],
      },
      {
        title: tr("Limits"),
        paragraphs: [
          "Sleep Performance scores the main sleep only, once Fitbit has processed it. A night without deep and REM totals scores its restorative part as zero, so it reads lower. Without a consistency reading, that part counts as 50%. Sleep stages come from a wrist sensor and are an estimate.",
        ],
      },
    ],
  },
  {
    slug: "sleep-planner",
    name: "Sleep Planner",
    summary: tr("Tonight’s sleep need, and the bedtimes that meet it."),
    href: "/sleep",
    sections: [
      {
        title: tr("What goes in"),
        rows: [
          { term: "Your sleep need", detail: tr("The upper quartile of your last 28 nights, between 8 and 9.5 hours.") },
          { term: "Today’s Strain", detail: tr("Strain above your 28-day average adds to the need.") },
          { term: "Sleep debt", detail: tr("What you owe from recent nights.") },
          { term: "Naps", detail: tr("Today’s naps take time off tonight’s need.") },
          { term: "Your last 14 main sleeps", detail: tr("Your usual wake time and sleep efficiency.") },
        ],
      },
      {
        title: tr("How it is weighted"),
        paragraphs: [
          "Tonight’s need = your sleep need + 3\u00a0minutes for each Strain point above your 28-day average + 20% of your sleep debt − today’s nap time.",
          "Sleep debt runs over your last 14\u00a0nights with sleep. Each night, debt becomes 55% of (need + the debt so far − sleep), with the previous day’s naps counted as sleep; anything under 10\u00a0minutes clears to zero.",
          "Bedtimes count back from your median wake time on recent weekday or weekend mornings, to match tomorrow, allowing for your median efficiency (90% until known). A need of 8\u00a0hours, a 07:00 wake and 90% efficiency give a Peak bedtime of 22:07.",
        ],
      },
      {
        title: tr("What the bands mean"),
        rows: [
          { term: "Peak", detail: tr("100% of tonight’s need.") },
          { term: "Perform", detail: tr("85% of tonight’s need.") },
          { term: "Get by", detail: tr("70% of tonight’s need.") },
        ],
      },
      {
        title: tr("A worked example"),
        paragraphs: [
          "Take someone with a sleep need of 8 hours, which is 480 minutes. Today's Strain is 12.6 against a 28-day average of 9.45, so they are 3.15 points above their norm. Their sleep debt this morning is 60 minutes, they took a 20-minute nap, and tomorrow is a weekday. Over their last 14 main sleeps they have typically woken at 07:00 with 90% efficiency.",
          "Tonight's need starts from the 480 minutes. Strain adds 3 minutes for each point above average: 3.15 points gives 9.45 minutes. Debt adds 20%, so 60 minutes of debt gives 12. The nap takes off 20. That makes 480 + 9.45 + 12 - 20 = 481.45 minutes, about 8 hours 1 minute.",
          "Bedtimes then count back from 07:00. Because efficiency is 90%, time in bed is the sleep divided by 0.9. For Peak, 481.45 minutes of sleep needs 534.9 minutes in bed, so lights out at 22:05. Perform (85%) needs 454.7 minutes in bed, giving 23:25, and Get by (70%) needs 374.5 minutes, giving 00:45. These come from running Pulse's own sleep planner on those inputs. A harder day, more debt or a lower efficiency would all move the bedtimes earlier.",
        ],
      },
      {
        title: tr("Limits"),
        paragraphs: [
          "The planner needs 7 main sleeps before it gives bedtimes. It assumes tomorrow looks like your recent mornings and cannot see alarms or plans. Strain and naps later today change tonight’s need. It is a guide, not a prescription.",
        ],
      },
    ],
  },
  {
    slug: "pulse-age",
    name: "Pulse Age",
    summary: tr("How old your body behaves, and how fast that is changing."),
    href: "/health/healthspan",
    sections: [
      {
        title: tr("What goes in"),
        paragraphs: ["Nine habits and vitals, averaged over 6\u00a0months, each against a reference: a fit person of your age and sex."],
        rows: [
          { term: "VO2 max", detail: tr("From runs in the last 90 days, else Fitbit’s daily estimate at half weight. Reference: your age’s 75th percentile.") },
          { term: "Resting heart rate", detail: tr("Fitbit’s daily value from Google. Reference 60 bpm.") },
          { term: "Steps", detail: tr("Reference and cap: 10,000 a day under 60, 8,000 from 60.") },
          { term: "Sleep hours", detail: tr("Reference 7.5 hours; 7 to 8 scores the same.") },
          { term: "Sleep consistency", detail: tr("Reference 86.3.") },
          { term: "Heart rate zones 1-3", detail: tr("Daily time at 50-80% of your heart-rate reserve. Reference 150 minutes a week.") },
          { term: "Heart rate zones 4-5", detail: tr("Daily time at 80% of your heart-rate reserve and above. Reference 75 minutes a week.") },
          { term: "Strength activity", detail: tr("Reference 40 minutes a week.") },
          { term: "Lean body mass", detail: tr("Fat-free mass for your height. Needs weight, body fat and height.") },
        ],
      },
      {
        title: tr("How it is weighted"),
        paragraphs: [
          "Each input maps to a change in mortality risk from a published study. The changes are added, shrunk by 25% for overlap, scaled up when inputs are missing, and turned into years on the rule that mortality risk doubles about every 8\u00a0years. A resting heart rate of 70\u00a0bpm, all else at reference, adds about 0.75\u00a0years.",
          "Pace of Aging repeats this for your last 30\u00a0days: 1 + (30-day years − 6-month years) ÷ 5.",
        ],
      },
      {
        title: tr("What the bands mean"),
        rows: [
          { term: "Younger than your age", detail: tr("Your inputs beat the reference on balance.") },
          { term: "Older than your age", detail: tr("They fall short. The reference is fit, so many people start here.") },
          { term: "Pace below 1.0x", detail: tr("Your last 30 days look younger than your 6 months.") },
          { term: "Pace above 1.0x", detail: tr("They look older. Pace runs from −1.0x to 3.0x.") },
        ],
      },
      {
        title: tr("Limits"),
        paragraphs: [
          "Time in zones is counted by Pulse from your heart rate, on the same five zones as Strain. Pulse Age needs 5 of the 9 inputs, is Provisional until 20\u00a0days have data, stays within 15\u00a0years of your age and updates weekly. Pace of Aging is provisional until your data spans 6\u00a0months. Both rest on population studies, not a clinical test of your body.",
        ],
      },
    ],
  },
  {
    slug: "stress",
    name: "Stress Monitor",
    summary: tr("How far your heart rate sits above your calm level, from 0 to 3."),
    href: "/health/stress",
    sections: [
      {
        title: tr("What goes in"),
        rows: [
          { term: "Minute heart rate", detail: tr("The average heart rate of each minute.") },
          { term: "Steps", detail: tr("Only still minutes count: no steps in that minute or the 2 either side.") },
          { term: "Workouts and sleep", detail: tr("Minutes inside them are left out.") },
          { term: "Your calm baseline", detail: tr("Your resting daytime heart rate, from earlier days.") },
        ],
        paragraphs: [
          "Each day’s calm heart rate is the 10th percentile of its hourly averages between 06:00 and 22:00, using hours with at least 15 still minutes. It feeds the next day’s baseline.",
        ],
      },
      {
        title: tr("How it is weighted"),
        paragraphs: [
          "Each still minute’s distance above your baseline is measured in your usual spread, never less than 3.76\u00a0bpm, and mapped onto 0 to 3 on an S-shaped curve. At your baseline it reads 0.3, 1.5 spreads above reads 1.5, and 3 spreads above reads 2.7. Today Pulse shows the latest scored minute; past days show the day’s average.",
        ],
      },
      {
        title: tr("What the bands mean"),
        rows: [
          { term: "0-0.9", detail: tr("Low: calm.") },
          { term: "1.0-1.9", detail: tr("Medium: heart rate above your calm level.") },
          { term: "2.0-3.0", detail: tr("High: well above your calm level while you are still.") },
        ],
      },
      {
        title: tr("Limits"),
        paragraphs: [
          "Stress is Provisional until 4\u00a0days have set your baseline; until then it uses a fixed spread of 7.65\u00a0bpm, so 15\u00a0bpm above your calm level reads 2.0. It reads heart rate alone, so caffeine, heat, illness or recovering from exercise raise it too. It is not a measure of how you feel.",
        ],
      },
    ],
  },
  {
    slug: "energy-bank",
    name: "Energy Bank",
    summary: tr("An estimate of how much energy you have left today, 0 to 100%."),
    href: "/",
    sections: [
      {
        title: tr("What goes in"),
        rows: [
          { term: "Recovery and Sleep Performance", detail: tr("Set the starting level when you wake.") },
          { term: "Heart-rate load", detail: tr("Each minute’s heart-rate points, as in Strain.") },
          { term: "Stress", detail: tr("High-stress minutes drain; calm, still minutes recharge.") },
          { term: "Naps", detail: tr("Recharge.") },
        ],
      },
      {
        title: tr("How it is weighted"),
        paragraphs: ["At wake you start at 60% of Recovery plus 40% of Sleep Performance: Recovery 70% and sleep 80% start you at 74%. Then, minute by minute until bedtime:"],
        rows: [
          { term: "Awake", detail: tr("−0.04 a minute, about 38 over 16 hours.") },
          { term: "Heart-rate load", detail: tr("−0.08 a minute for each heart-rate point, 1 to 5. An hour at 70-79% of your reserve costs 14.4.") },
          { term: "High stress", detail: tr("−0.08 a minute.") },
          { term: "Low stress, still", detail: tr("+0.01 a minute.") },
          { term: "Napping", detail: tr("+0.25 a minute, with no drain.") },
        ],
      },
      {
        title: tr("What the bands mean"),
        rows: [
          { term: "67-100%", detail: tr("Plenty in reserve.") },
          { term: "34-66%", detail: tr("Pace yourself.") },
          { term: "0-33%", detail: tr("Running low.") },
        ],
        paragraphs: ["The level stays between 0 and 100%. The three biggest drains are listed by name."],
      },
      {
        title: tr("Limits"),
        paragraphs: [
          "Energy Bank needs today’s Recovery and last night’s main sleep; without them it shows no value, and it is Provisional while Recovery is. It is a model with tuned constants and no published validation, set so a typical day ends between 15% and 40%. It cannot see mental effort that leaves heart rate unchanged, food or caffeine. It is an estimate, not a measurement.",
        ],
      },
    ],
  },
  {
    slug: "health-monitor",
    name: "Health Monitor",
    summary: tr("Last night’s five vitals against your own normal ranges."),
    href: "/health/monitor",
    sections: [
      {
        title: tr("What goes in"),
        rows: [
          { term: "Resting heart rate", detail: tr("Fitbit’s daily resting heart rate from Google, in bpm.") },
          { term: "Heart rate variability", detail: tr("Fitbit’s nightly HRV, in ms.") },
          { term: "Respiratory rate", detail: tr("Breaths per minute asleep, in rpm.") },
          { term: "SpO2", detail: tr("Blood oxygen overnight, in %.") },
          { term: "Skin temperature", detail: tr("Last night against Google’s skin-temperature baseline, in °C.") },
        ],
      },
      {
        title: tr("How it is weighted"),
        paragraphs: [
          "Resting heart rate and HRV use Google’s personal ranges when Google gives them, and skin temperature uses ± 2 of Google’s 30-night standard deviation around its baseline. Otherwise, and always for respiratory rate and SpO2, a normal range is your baseline ± 2 of your usual night-to-night swings, built from earlier nights only. Pulse’s narrowest ranges are about ±5\u00a0bpm, ±12.5\u00a0ms, ±1.25\u00a0rpm, ±1.25\u00a0points of SpO2 and ±0.75\u00a0°C. SpO2 is one-sided: below 95% is always low, and a high value is never flagged.",
          "The illness signal compares resting heart rate, HRV, skin temperature and respiratory rate with your 30\u00a0nights before. A vital fires at 2 standard deviations in the unwell direction and adds 22\u00a0points per extra deviation, up to 40. With at least 2 vitals firing, 25\u00a0points is mild and 50 is raised. If you logged alcohol, sauna or travel the day before, Pulse takes that as the likely cause instead.",
        ],
      },
      {
        title: tr("What the bands mean"),
        rows: [
          { term: "Within range", detail: tr("Inside your normal range.") },
          { term: "Elevated or Low", detail: tr("Outside it; the chip names the bound you crossed.") },
          { term: "Below 95%", detail: tr("SpO2 under 95%, whatever your range.") },
          { term: "Illness signal", detail: tr("Several vitals moved together, a pattern often seen early in illness.") },
        ],
      },
      {
        title: tr("Limits"),
        paragraphs: [
          "A range from Google is there as soon as Google sends one. Pulse’s own range needs 4 earlier nights and lapses after 14\u00a0nights without a value; without Google’s baseline, skin temperature needs Pulse’s own first, so it takes about 8\u00a0nights. The illness signal stays quiet until 14 of your last 30\u00a0nights have resting heart rate or HRV. A flagged vital is a prompt to notice, not a diagnosis.",
        ],
      },
    ],
  },
  {
    slug: "fitness",
    name: "Fitness level",
    summary: tr("Your VO2 max compared with people of your age and sex."),
    href: "/health/fitness",
    sections: [
      {
        title: tr("What goes in"),
        rows: [
          { term: "VO2 max", detail: tr("Your latest run value from the last 90 days; otherwise Fitbit’s latest daily estimate, marked Provisional.") },
          { term: "Age and sex", detail: tr("From your profile.") },
        ],
      },
      {
        title: tr("How it is weighted"),
        paragraphs: [
          "Pulse places your VO2 max in the FRIEND reference table (Kaminsky 2015): lab treadmill tests from 7,783 adults without heart disease, by sex and age decade. It reads between the published percentiles and keeps the result between the 5th and the 95th. Under 20 uses the 20-29 row; 80 and over uses 70-79. A man of 35 at 45.0\u00a0ml/kg/min sits just under the 60th percentile: Good.",
        ],
      },
      {
        title: tr("What the bands mean"),
        rows: [
          { term: "80th percentile and up", detail: tr("Superior") },
          { term: "60th-79th", detail: tr("Excellent") },
          { term: "40th-59th", detail: tr("Good") },
          { term: "20th-39th", detail: tr("Fair") },
          { term: "Below the 20th", detail: tr("Poor") },
        ],
      },
      {
        title: tr("A worked example"),
        paragraphs: [
          "Take a woman of 52 whose Fitbit reports a VO2 max of 30 ml/kg/min from a recent run. Pulse picks the FRIEND treadmill row for women aged 50 to 59. That row reads 27.6 at the 75th percentile and 32.0 at the 90th.",
          "Her 30 sits between those two columns. Pulse reads linearly between them: it is 2.4 above the 75th-percentile value, out of a 4.4 gap, and the gap spans 15 percentile points. So the percentile is 75 plus 15 times 2.4 divided by 4.4, which is 83.2. Pulse shows it as the 83rd percentile.",
          "The bands are cut at the 20th, 40th, 60th and 80th percentiles, so 83.2 lands in Superior. Running Pulse's fitness level function on 30, age 52 and female returns exactly that.",
          "For comparison, a man of 35 with a VO2 max of 45 sits between the 50th and 75th columns of his row (42.4 and 49.2). That gives 59.6, just under the 60 cut-off, so he is Good rather than Excellent. The same VO2 max is a different percentile at a different age or sex, which is the point of the table. A value below the 5th-percentile column is shown as 5 and one above the 95th as 95, because the table does not resolve the tails.",
        ],
      },
      {
        title: tr("Limits"),
        paragraphs: [
          "Fitbit’s VO2 max is an estimate, while the table is lab-measured, so treat the percentile as approximate. The 2015 table runs 1.5-4.6\u00a0ml/kg/min higher than its 2022 update, so you may place a little low. The same table’s 75th percentile is the VO2 max reference in Pulse Age.",
        ],
      },
    ],
  },
  {
    slug: "training-balance",
    name: "Training balance",
    summary: tr("Whether your recent strain is above or below what you are used to."),
    href: "/health/fitness",
    sections: [
      {
        title: tr("What goes in"),
        paragraphs: [
          "Your daily Strain. A day with the band worn but too little heart rate counts as 0; a day without the band is skipped. Today’s Strain so far counts toward today’s ratio.",
        ],
      },
      {
        title: tr("How it is weighted"),
        paragraphs: [
          "Training load (ACWR) is your average Strain over the last 7\u00a0days with data, divided by your average over the last 28. 1.00 means this week matches your usual. Reports use the last day of the week or month that has a ratio; Fitness shows today’s.",
        ],
      },
      {
        title: tr("What the bands mean"),
        rows: [
          { term: "Below 0.80", detail: tr("Undertrained (Detraining on Fitness): load dropped below your usual.") },
          { term: "0.80-1.29", detail: tr("Balanced (Optimal): the usual sweet spot.") },
          { term: "1.30-1.49", detail: tr("Overreaching (Pushing): load is rising faster than you are used to.") },
          { term: "1.50 and up", detail: tr("Overreaching (High risk): load jumped well above your usual.") },
        ],
      },
      {
        title: tr("A worked example"),
        paragraphs: [
          "Take 28 days of Strain on the 0-21 scale, oldest first: 10, 12, 0, 13, 11, 9, 14, then 11, 12, 0, 12, 10, 13, 12, then 10, 13, 0, 11, 12, 14, 9, and finally 12, 15, 13, 0, 16, 14, 15. The zeros are rest days with the band on, so they count.",
          "The last 7 days average 12.14 Strain. That is the acute load. All 28 days average 10.46, the chronic load. Training load, the acute to chronic workload ratio (ACWR), is 12.14 / 10.46 = 1.16.",
          "Pulse reads that against its bands: below 0.80 is Undertrained, 0.80 to 1.29 is Balanced, 1.30 to 1.49 is Pushing and 1.50 and up is High risk. At 1.16 this person is Balanced: the last week is a little heavier than usual, which is normal progression.",
          "The same week with a ratio of 1.45 would read Pushing, even though the daily numbers might not feel different. That is the point of the ratio: it compares you with yourself, not with anyone else's load.",
        ],
      },
      {
        title: tr("Limits"),
        paragraphs: [
          "Training load needs 14\u00a0days of Strain; until there are 28, your usual is the average of the days you have. It compares you with yourself, so it says nothing about whether your usual load suits your goals. The 0.8-1.3 sweet spot comes from team-sport injury research (Gabbett 2016) and is a rule of thumb.",
        ],
      },
    ],
  },
  {
    slug: "journal-impact",
    name: "Behaviour insights",
    summary: tr("How each behaviour you log goes with your next day’s scores."),
    href: "/journal/insights",
    sections: [
      {
        title: tr("What goes in"),
        rows: [
          { term: "Journal check-ins", detail: tr("Each behaviour you answered yes or no, over the last 90 days.") },
          { term: "Next-day scores", detail: tr("The next morning’s Recovery and HRV, and that night’s Sleep Performance.") },
        ],
      },
      {
        title: tr("How it is weighted"),
        paragraphs: [
          "For each behaviour, Pulse compares the days you answered yes with the days you answered no: the difference in average next-day score. HRV shows as the change in standard deviations from your baseline. To see how sure that difference is, Pulse resamples your days 1,000 times and keeps the middle 90% of the results.",
        ],
      },
      {
        title: tr("What the bands mean"),
        rows: [
          { term: "Positive or negative", detail: tr("That whole 90% range sits above or below zero: a clear effect.") },
          { term: "No clear effect", detail: tr("The range crosses zero.") },
          { term: "Needs more data", detail: tr("Fewer than 5 yes days or 5 no days.") },
        ],
      },
      {
        title: tr("A worked example"),
        paragraphs: [
          "Say someone logs alcohol for a month. Over 29 days they answer yes on 8 and no on 21. Pulse pairs each answer with the next morning's Recovery, because the question is what the day after looks like.",
          "On the 21 no days, next-morning Recovery averages higher than after the 8 yes days. The difference of the two averages, yes minus no, comes out at minus 11.6 points: on the day after alcohol, Recovery was about 12 points lower.",
          "That difference alone could be luck, so Pulse resamples. It redraws 8 yes days and 21 no days with replacement, takes the difference again, repeats 1,000 times, and keeps the middle 90% of the results. For this data the range runs from minus 14.7 to minus 8.4.",
          "The whole range sits below zero, so the label is Negative, a clear effect. Had the range run from, say, minus 4 to plus 6, the label would be No clear effect. Had there been only 4 yes days, Pulse would say Needs more data, because it needs at least 5 yes and 5 no days. These figures come from running Pulse's behaviour insights function on 29 check-ins and 30 daily Recovery scores. It shows an association, not proof of cause.",
        ],
      },
      {
        title: tr("Limits"),
        paragraphs: [
          "This is an association, not proof of cause. It does not adjust for other behaviours or training, so a tag you tend to log on hard days can look harmful. About 1 in 10 behaviours with no real effect will still show a clear one by chance. Days without an answer are left out.",
        ],
      },
    ],
  },
  {
    slug: "sleep-consistency",
    name: "Sleep consistency",
    summary: tr("How closely your sleep and wake times repeat from day to day."),
    href: "/sleep",
    sections: [
      {
        title: tr("What goes in"),
        rows: [
          { term: "Sleep sessions", detail: tr("Main sleeps and naps, minute by minute.") },
          { term: "Band wear", detail: tr("A day counts only if the band recorded heart rate for at least half of it.") },
        ],
      },
      {
        title: tr("How it is weighted"),
        paragraphs: [
          "Pulse splits the last 7 noon-to-noon days into minutes, each asleep or awake, and checks each minute against the same minute the next day. The Sleep Regularity Index (Phillips 2017) is −100 + 200 × the share that match: 100 means an identical schedule, around 0 a random one. Pulse shows it from 0 to 100%, with anything below zero as 0%. A 1-hour nap lowers it by about 3\u00a0points.",
          "It makes up 10% of Sleep Performance and is one of the inputs to Pulse Age.",
        ],
      },
      {
        title: tr("What the bands mean"),
        rows: [
          { term: "80-100%", detail: tr("Optimal") },
          { term: "70-79%", detail: tr("Sufficient") },
          { term: "0-69%", detail: tr("Poor") },
        ],
      },
      {
        title: tr("A worked example"),
        paragraphs: [
          "Take a week where someone sleeps 23:00 to 07:00 every night, except Friday and Saturday, when they go to bed at 01:00 and sleep until 09:00. Pulse splits the seven noon-to-noon days into 1,440 minutes each and marks every minute asleep or awake. It then compares each minute with the same minute 24 hours later, across six day-to-day pairs, 8,640 minutes in all.",
          "A normal night followed by a late one mismatches for four hours: the person was asleep 23:00 to 01:00 on the first day but awake, and asleep 07:00 to 09:00 on the second but awake the day before. The late Saturday-to-Sunday step costs another four hours. Friday to Saturday matches perfectly, since both nights are late. That is 8 hours, or 480 minutes, of mismatch, so 8,160 of 8,640 minutes match, or 94.4%.",
          "The index is -100 + 200 × 0.944, which is 88.9. Pulse shows that as 89%, which is Optimal (80-100%). Running Pulse's own regularity function on these sleep times gives the same figure. Two nights two hours late cost 11 points even with identical total sleep, which shows that the score rewards timing, not duration. A single one-hour nap would cost about 3 points more.",
        ],
      },
      {
        title: tr("Limits"),
        paragraphs: [
          "It needs 2 worn days in a row within the window; otherwise there is no value. Days without the band are skipped rather than counted as awake. Fitbit’s sleep sessions leave out brief wakes, so this reads somewhat higher than a lab measure. On the night the clocks change, times are compared 1\u00a0hour apart.",
        ],
      },
    ],
  },
  {
    slug: "training-load",
    name: "Fitness, fatigue and form",
    summary: tr("Your long-term and short-term training load, and the gap between them."),
    href: "/health/fitness",
    sections: [
      {
        title: tr("What goes in"),
        paragraphs: [
          "Your daily Strain, on Pulse’s internal 0-100 effort scale rather than 0 to 21. A day with the band worn but too little heart rate counts as 0.",
        ],
      },
      {
        title: tr("How it is weighted"),
        rows: [
          { term: "Fitness", detail: tr("A rolling average of daily load that fades with a 42-day time constant.") },
          { term: "Fatigue", detail: tr("The same with a 7-day time constant, so it reacts faster.") },
          { term: "Form", detail: tr("Fitness minus Fatigue.") },
        ],
        paragraphs: ["Both averages start from your mean load over the first 7\u00a0days."],
      },
      {
        title: tr("What the bands mean"),
        rows: [
          { term: "Form above 0", detail: tr("Your recent load is lighter than your longer-term load: you are fresher.") },
          { term: "Form below 0", detail: tr("You are carrying fatigue from recent training.") },
        ],
      },
      {
        title: tr("A worked example"),
        paragraphs: [
          "Take someone with 14 days of band data. Their daily Strain, converted to Pulse's internal 0-100 effort scale, runs 30, 45, 0, 50, 40, 35, 55, then 45, 60, 0, 50, 55, 40, 65. The zeros are rest days with the band worn, so they count. A day without the band would have restarted the run.",
          "Fitness and Fatigue both start from the mean of the first 7 days, which is 36.4. After that, each day moves the average by a fixed share of the gap between that day's load and the current average. For Fitness (42-day time constant) the share is 1 - e^(-1/42), about 2.4%. For Fatigue (7-day) it is 1 - e^(-1/7), about 13.3%, so it reacts far faster.",
          "Walking through the second week, Fitness drifts up from 36.4 to 37.8, while Fatigue swings between 35.2 and 43.0 and ends at 43.0 after the 65 on day 14. Form is Fitness minus Fatigue: 37.8 - 43.0 = -5.2.",
          "A negative Form means recent load is heavier than the longer-term average, so this person is carrying fatigue from a hard second week. The averages only settle after about 42 days, so read the first few weeks as a rough guide.",
        ],
      },
      {
        title: tr("Limits"),
        paragraphs: [
          "It needs 14\u00a0days in a row with Strain data, and a day without the band starts the run again. It settles after about 42\u00a0days. Heart rate is its only input, so load that barely raises heart rate is missed.",
        ],
      },
    ],
  },
  {
    slug: "hr-recovery",
    name: "Heart rate recovery",
    summary: tr("How far your heart rate drops in the minute after a workout."),
    href: null,
    sections: [
      {
        title: tr("What goes in"),
        rows: [
          { term: "End heart rate", detail: tr("The highest reading in the last 30 seconds of the activity.") },
          { term: "One minute later", detail: tr("The median reading 45-75 seconds after the end, from at least 3 readings.") },
        ],
      },
      {
        title: tr("How it is weighted"),
        paragraphs: [
          "Heart rate recovery = end heart rate − heart rate one minute later, in bpm. It is measured only after a hard enough finish: at least 2\u00a0minutes in a row at 70% or more of your max heart rate within the last 5\u00a0minutes.",
        ],
      },
      {
        title: tr("What the bands mean"),
        rows: [
          { term: "20\u00a0bpm or more", detail: tr("Good") },
          { term: "12-19 bpm", detail: tr("Typical") },
          { term: "Below 12\u00a0bpm", detail: tr("Low") },
        ],
      },
      {
        title: tr("A worked example"),
        paragraphs: [
          "Take a 36-year-old finishing a steady run of about 17 minutes. Pulse's default max heart rate for that age is about 183 bpm, so the 70% line is 128 bpm. For the last 5 minutes of the run the watch records between 160 and 174 bpm, well above the line for far longer than the 2 minutes required, so the workout is eligible.",
          "Next Pulse takes the highest reading in the final 30 seconds. Here that is 174 bpm. It then collects every reading from 45 to 75 seconds after the workout ended. Six readings fall in that window: 146, 146, 148, 149, 149 and 150 bpm. The median of an even count is the average of the middle two, 148.5, rounded half up to 149.",
          "Heart rate recovery is 174 minus 149, so 25 bpm. That is 20 or more, which Pulse calls Good. These numbers come from running Pulse's own heart rate recovery function on that set of readings.",
          "Change one thing and the answer moves. If the same runner had kept walking for the first minute and the median had been 160, the drop would be 14 bpm, which is Typical. If the watch had logged only two readings in the window, Pulse would show Not enough heart-rate data instead of guessing.",
        ],
      },
      {
        title: tr("Limits"),
        paragraphs: [
          "It needs dense heart rate around the end of the activity, which Fitbit does not always record; otherwise it shows Not enough heart-rate data. Moving about in that first minute, or stopping the activity late, lowers the drop. Compare it across similar workouts, not between different sports.",
        ],
      },
    ],
  },
]
