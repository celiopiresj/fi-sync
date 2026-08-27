import type { RiskStatus } from "../_types/types";

// Shared by ProjectionCard, ProjectionList, and the detail page's status
// badge so the three can't drift into slightly different colors for the
// same status. Semantic tokens (--positive/--warning/--negative), never
// raw Tailwind emerald/amber/rose — AGENTS.md's money/status color
// convention.
export const RISK_BADGE_CLASS: Record<RiskStatus, string> = {
  ok: "border-positive/30 bg-positive/10 text-positive",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-negative/30 bg-negative/10 text-negative",
};

export const RISK_TEXT_CLASS: Record<RiskStatus, string> = {
  ok: "text-positive",
  warning: "text-warning",
  danger: "text-negative",
};
