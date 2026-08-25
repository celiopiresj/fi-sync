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
  TagIcon,
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
    | "recurrences"
    | "cards"
    | "categories"
    | "budgets";
  icon: ComponentType<IconProps>;
};

export type NavSection = {
  // Matches a key under `nav.sections` in common.json.
  labelKey: "dayToDay" | "planning" | "records";
  items: NavItem[];
};

// Grouped for the sidebar (tasks/xxx, transactions screen redesign
// section 6): "Dia a dia" for the screens used day-to-day, "Planejamento"
// for forward-looking planning tools (budgets), "Cadastros" for the ones
// that manage setup/registry data (accounts, cards, invoices, people)
// rather than being visited constantly.
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
    labelKey: "planning",
    items: [
      {
        href: "/budgets",
        labelKey: "budgets",
        icon: ChartPieSliceIcon,
      },
    ],
  },
  {
    labelKey: "records",
    items: [
      { href: "/accounts", labelKey: "accounts", icon: BankIcon },
      { href: "/cards", labelKey: "cards", icon: CreditCardIcon },
      { href: "/categories", labelKey: "categories", icon: TagIcon },
      { href: "/invoices", labelKey: "invoices", icon: ReceiptIcon },
      { href: "/people", labelKey: "people", icon: UsersThreeIcon },
    ],
  },
];

// Flattened for anything that still wants a plain list (unchanged shape
// from before the sections split).
export const navItems: NavItem[] = navSections.flatMap((section) => section.items);

