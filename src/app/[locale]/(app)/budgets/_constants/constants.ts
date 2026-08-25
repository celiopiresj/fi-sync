// Threshold breakpoints for budget progress bar colors. A category's
// spending percentage maps to one of these tiers — the first one whose
// `max` is >= the percentage wins. Green → yellow → orange → red
// progression gives a visual "heat" cue before the user hits 100%.
export const PROGRESS_THRESHOLDS = [
  { max: 60, color: "green" },
  { max: 80, color: "yellow" },
  { max: 100, color: "orange" },
  { max: Infinity, color: "red" },
] as const;

export type ThresholdColor = (typeof PROGRESS_THRESHOLDS)[number]["color"];

// Alert thresholds — toast notifications are shown when these
// percentages are exceeded. Checked once on page load, not continuously.
export const ALERT_THRESHOLD_WARNING = 80;
export const ALERT_THRESHOLD_DANGER = 100;

// Number of months to use when computing average-based budget suggestions.
export const SUGGESTION_MONTHS_COUNT = 3;
