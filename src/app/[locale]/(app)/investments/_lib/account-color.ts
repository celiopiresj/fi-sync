// Same rotating, meaning-free color-by-id scheme as accounts/_lib/
// account-color.ts and invoices/_lib/account-color.ts — duplicated per
// route rather than shared, per this codebase's per-route self-
// containment convention (AGENTS.md).
const PALETTE = [
  { bg: "bg-violet-100", icon: "text-violet-600" },
  { bg: "bg-emerald-100", icon: "text-emerald-600" },
  { bg: "bg-sky-100", icon: "text-sky-600" },
  { bg: "bg-amber-100", icon: "text-amber-600" },
  { bg: "bg-rose-100", icon: "text-rose-600" },
  { bg: "bg-teal-100", icon: "text-teal-600" },
] as const;

export function getAccountColorClasses(accountId: string) {
  let hash = 0;
  for (let i = 0; i < accountId.length; i++) {
    hash = (hash * 31 + accountId.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
