// Rotating, meaning-free color per credit-card account — same hash
// approach as accounts/_lib/account-color.ts, with dark-mode-safe tints.
const PALETTE = [
  {
    bg: "bg-violet-100 dark:bg-violet-500/20",
    icon: "text-violet-600 dark:text-violet-300",
  },
  {
    bg: "bg-emerald-100 dark:bg-emerald-500/20",
    icon: "text-emerald-600 dark:text-emerald-300",
  },
  {
    bg: "bg-sky-100 dark:bg-sky-500/20",
    icon: "text-sky-600 dark:text-sky-300",
  },
  {
    bg: "bg-amber-100 dark:bg-amber-500/20",
    icon: "text-amber-600 dark:text-amber-300",
  },
  {
    bg: "bg-rose-100 dark:bg-rose-500/20",
    icon: "text-rose-600 dark:text-rose-300",
  },
  {
    bg: "bg-teal-100 dark:bg-teal-500/20",
    icon: "text-teal-600 dark:text-teal-300",
  },
] as const;

export function getAccountColorClasses(accountId: string) {
  let hash = 0;
  for (let i = 0; i < accountId.length; i++) {
    hash = (hash * 31 + accountId.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
