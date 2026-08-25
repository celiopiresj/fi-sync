export type UsageTier = "ok" | "warning" | "critical";

// The three usage-percent bands the cards screen colors by: green below
// 70%, amber 70-94%, red at 95%+ (which also naturally covers an
// overspent/negative available limit, since that pushes usagePercent
// past 100).
export function getUsageTier(usagePercent: number): UsageTier {
  if (usagePercent >= 95) return "critical";
  if (usagePercent >= 70) return "warning";
  return "ok";
}
