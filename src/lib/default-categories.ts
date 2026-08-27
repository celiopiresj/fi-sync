import type { CategoryType } from "@/generated/prisma/client";

// The starter set of Category rows every user should see from day one.
// Created with `userId: null` — "system-seeded category, shared by
// everyone" (see prisma/schema.prisma) — the first time anyone signs in
// after this shipped (see ensureUserSynced in src/lib/auth/sync-user.ts).
// Also reused by prisma/seed.ts for the demo dataset, so the demo never
// drifts from what a real user actually gets.
//
// Covers all three `CategoryType` values (EXPENSE/INCOME/INVESTMENT) —
// `type` must be set explicitly per entry since Prisma's column default
// (`EXPENSE`) would otherwise silently mistype every INCOME/INVESTMENT
// row here.
//
// `icon` is a bare Phosphor icon name (no "Icon" suffix) — see
// src/lib/category-icons.ts, which appends the suffix when resolving the
// component. Every icon below is already registered in that file's
// `CATEGORY_ICONS` map.
//
// `colorStyle` must be one of `AVAILABLE_COLORS`' `class` values (see
// src/components/form/color-picker.tsx — the same 8-color palette users
// pick from when editing a category) — copied as literal strings here
// rather than imported, so this stays a plain data module the seed
// scripts (prisma/seed.ts, scripts/seed-categories.ts) can run through
// `tsx` without pulling in a React component file. Reused across
// multiple categories below; there's no 1:1 requirement, just enough
// variety that the category list/grid doesn't look monochrome.

const ORANGE =
  "bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400";
const PURPLE =
  "bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400";
const INDIGO =
  "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400";
const EMERALD =
  "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400";
const TEAL = "bg-teal-100 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400";
const SKY = "bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400";
const BLUE = "bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400";
const ROSE = "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400";

// Deliberately a plain (not `as const`) array — nothing here needs the
// literal string types, and a `readonly` array/tuple can't be passed
// straight into Prisma's `createMany({ data: ... })` without a spread.
export const DEFAULT_CATEGORIES: {
  name: string;
  type: CategoryType;
  icon: string;
  colorStyle: string;
}[] = [
  // Expense
  { name: "Alimentação", type: "EXPENSE", icon: "ForkKnife", colorStyle: ORANGE },
  { name: "Transporte", type: "EXPENSE", icon: "Car", colorStyle: BLUE },
  { name: "Moradia", type: "EXPENSE", icon: "House", colorStyle: INDIGO },
  { name: "Lazer", type: "EXPENSE", icon: "Confetti", colorStyle: PURPLE },
  { name: "Saúde", type: "EXPENSE", icon: "Heartbeat", colorStyle: ROSE },
  { name: "Educação", type: "EXPENSE", icon: "GraduationCap", colorStyle: SKY },
  { name: "Compras", type: "EXPENSE", icon: "ShoppingBag", colorStyle: ROSE },
  { name: "Vestuário", type: "EXPENSE", icon: "TShirt", colorStyle: PURPLE },
  { name: "Viagem", type: "EXPENSE", icon: "Airplane", colorStyle: SKY },
  { name: "Pets", type: "EXPENSE", icon: "PawPrint", colorStyle: ORANGE },
  { name: "Assinaturas", type: "EXPENSE", icon: "Television", colorStyle: INDIGO },
  { name: "Presentes", type: "EXPENSE", icon: "Gift", colorStyle: ROSE },
  { name: "Impostos", type: "EXPENSE", icon: "Receipt", colorStyle: BLUE },
  { name: "Seguros", type: "EXPENSE", icon: "Umbrella", colorStyle: INDIGO },
  { name: "Serviços", type: "EXPENSE", icon: "Wrench", colorStyle: ORANGE },
  { name: "Tecnologia", type: "EXPENSE", icon: "DeviceMobile", colorStyle: BLUE },
  { name: "Academia", type: "EXPENSE", icon: "Barbell", colorStyle: PURPLE },
  { name: "Filhos", type: "EXPENSE", icon: "Baby", colorStyle: SKY },

  // Income
  { name: "Salário", type: "INCOME", icon: "Money", colorStyle: EMERALD },
  { name: "Freelance", type: "INCOME", icon: "Briefcase", colorStyle: TEAL },
  { name: "Bônus", type: "INCOME", icon: "Coins", colorStyle: EMERALD },
  { name: "Reembolso", type: "INCOME", icon: "Wallet", colorStyle: TEAL },
  { name: "Rendimentos", type: "INCOME", icon: "ChartLine", colorStyle: EMERALD },
  { name: "Outras Receitas", type: "INCOME", icon: "Coin", colorStyle: TEAL },

  // Investment
  { name: "Ações", type: "INVESTMENT", icon: "ChartBar", colorStyle: TEAL },
  { name: "Renda Fixa", type: "INVESTMENT", icon: "Bank", colorStyle: EMERALD },
  { name: "Fundos Imobiliários", type: "INVESTMENT", icon: "Buildings", colorStyle: INDIGO },
  { name: "Criptomoedas", type: "INVESTMENT", icon: "CurrencyBtc", colorStyle: PURPLE },
  { name: "Previdência", type: "INVESTMENT", icon: "PiggyBank", colorStyle: TEAL },
  { name: "Reserva de Emergência", type: "INVESTMENT", icon: "Vault", colorStyle: EMERALD },
];
