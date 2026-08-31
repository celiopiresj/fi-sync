import type { ComponentType } from "react";
import {
  HouseIcon,
  ArrowsLeftRightIcon,
  UsersThreeIcon,
  ReceiptIcon,
  BankIcon,
  ArrowsClockwiseIcon,
  CreditCardIcon,
  ChartPieSliceIcon,
  HandCoinsIcon,
  PiggyBankIcon,
  TagIcon,
  TrendUpIcon,
  type IconProps,
} from "@phosphor-icons/react";

// Sidebar entries. `labelKey` maps to `common.json`'s `nav.*` messages —
// add a matching key there for every new item. Real screens replace the
// placeholder pages one task at a time (see tasks/003-app-shell.md); this
// list doesn't change when that happens, only the page content behind
// each `href` does.
export type NavItem = {
  href: string;
  // Matches a key under `nav` in src/messages/{locale}/common.json.
  labelKey:
    | "home"
    | "transactions"
    | "people"
    | "invoices"
    | "accounts"
    | "investments"
    | "recurrences"
    | "cards"
    | "loans"
    | "categories"
    | "budgets"
    | "projections";
  icon: ComponentType<IconProps>;
};

export type NavSection = {
  // Matches a key under `nav.sections` in common.json.
  labelKey: "dayToDay" | "wallet" | "planning" | "records";
  items: NavItem[];
};

// Grouped for the sidebar: "Dia a dia" for the screens used day-to-day,
// "Carteira" for the ones tracking real money/liquidity — every
// account-shaped entity (checking/savings/cash, investments/pockets,
// credit cards) plus their statements (faturas), split out from
// "Cadastros" specifically so that section doesn't mix real balances/debt
// with plain organizational lookup tables, "Planejamento" for
// forward-looking planning tools (budgets, projections), "Cadastros" for
// the reusable, non-monetary entities (categories, people) referenced
// elsewhere in the app.
export const navSections: NavSection[] = [
  {
    labelKey: "dayToDay",
    items: [
      { href: "/", labelKey: "home", icon: HouseIcon },
      {
        href: "/transactions",
        labelKey: "transactions",
        icon: ArrowsLeftRightIcon,
      },
      {
        href: "/recurrences",
        labelKey: "recurrences",
        icon: ArrowsClockwiseIcon,
      },
    ],
  },
  {
    labelKey: "wallet",
    items: [
      { href: "/accounts", labelKey: "accounts", icon: BankIcon },
      { href: "/investments", labelKey: "investments", icon: PiggyBankIcon },
      { href: "/cards", labelKey: "cards", icon: CreditCardIcon },
      { href: "/invoices", labelKey: "invoices", icon: ReceiptIcon },
      { href: "/loans", labelKey: "loans", icon: HandCoinsIcon },
    ],
  },
  {
    labelKey: "planning",
    items: [
      {
        href: "/budgets",
        labelKey: "budgets",
        icon: ChartPieSliceIcon,
      },
      {
        href: "/projections",
        labelKey: "projections",
        icon: TrendUpIcon,
      },
    ],
  },
  {
    labelKey: "records",
    items: [
      { href: "/categories", labelKey: "categories", icon: TagIcon },
      { href: "/people", labelKey: "people", icon: UsersThreeIcon },
    ],
  },
];

// Flattened for anything that still wants a plain list (unchanged shape
// from before the sections split).
export const navItems: NavItem[] = navSections.flatMap((section) => section.items);

