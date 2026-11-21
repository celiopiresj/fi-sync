import {
  ArrowsLeftRightIcon,
  BankIcon,
  PlusCircleIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import type { KpiTone } from "@/components/screen/kpi-card";

// Shortcuts shown on the home screen (grid on phones, header buttons on
// desktop). `label` is a key under `scrn-home.quickActions`.
export const QUICK_ACTIONS = [
  { label: "newTransaction", href: "/transactions", icon: PlusCircleIcon, primary: true },
  { label: "transfer", href: "/transactions", icon: ArrowsLeftRightIcon, primary: false },
  { label: "split", href: "/people", icon: UsersIcon, primary: false },
  { label: "sync", href: "/open-finance", icon: BankIcon, primary: false },
] as const;

// How many accounts "Minhas contas" shows (a 2x2 grid); the rest are
// behind "Ver todas".
export const HOME_ACCOUNTS_LIMIT = 4;

// Progress bar fill per tone (the month summary's "spent of income" bar).
export const TONE_BAR: Record<KpiTone, string> = {
  default: "bg-muted-foreground/40",
  positive: "bg-positive",
  negative: "bg-negative",
  warning: "bg-warning",
};

// Icon badge per alert tone. The tone rides on the badge, not on the
// row's background, so alert rows read like the other home lists.
export const ATTENTION_TONE_BADGE = {
  warning: "bg-warning/10 text-warning",
  negative: "bg-negative/10 text-negative",
  default: "bg-muted text-muted-foreground",
} as const;
