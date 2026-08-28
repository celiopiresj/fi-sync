import {
  WalletIcon,
  CreditCardIcon,
  TagIcon,
  UsersThreeIcon,
  ChartPieSliceIcon,
  type IconProps,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";

// Mirrors the reference implementation's own step list (trilhofin's
// _constants/Icons.ts) — key -> icon + translation key under
// scrn-onboarding.json's `steps.*`.
export const ONBOARDING_STEPS = [
  { key: "account", icon: WalletIcon },
  { key: "cards", icon: CreditCardIcon },
  { key: "categories", icon: TagIcon },
  { key: "people", icon: UsersThreeIcon },
  { key: "budget", icon: ChartPieSliceIcon },
] as const satisfies { key: string; icon: ComponentType<IconProps> }[];

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number]["key"];
