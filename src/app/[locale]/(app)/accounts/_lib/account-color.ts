// Rotating, meaning-free color per account (no bank/institution modeling
// exists in the schema — see prisma/schema.prisma's top comment) — picked
// by hashing the account id so the same account always lands on the same
// color across reorders/re-renders, without persisting anything. The
// `dark:` pair keeps the tint soft on the dark theme instead of a bright
// pastel chip.
const PALETTE = [
  { bg: "bg-violet-100 dark:bg-violet-500/15", icon: "text-violet-600 dark:text-violet-400" },
  { bg: "bg-emerald-100 dark:bg-emerald-500/15", icon: "text-emerald-600 dark:text-emerald-400" },
  { bg: "bg-sky-100 dark:bg-sky-500/15", icon: "text-sky-600 dark:text-sky-400" },
  { bg: "bg-amber-100 dark:bg-amber-500/15", icon: "text-amber-600 dark:text-amber-400" },
  { bg: "bg-rose-100 dark:bg-rose-500/15", icon: "text-rose-600 dark:text-rose-400" },
  { bg: "bg-teal-100 dark:bg-teal-500/15", icon: "text-teal-600 dark:text-teal-400" },
] as const;

export function getAccountColorClasses(accountId: string) {
  let hash = 0;
  for (let i = 0; i < accountId.length; i++) {
    hash = (hash * 31 + accountId.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
