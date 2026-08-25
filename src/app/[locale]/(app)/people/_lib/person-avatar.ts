// Rotating, meaning-free avatar color per person, same spirit as
// getAccountColorClasses (accounts/_lib/account-color.ts) but hashed off
// the name instead of the id — two different people can share a color,
// but a given person's card never flips color between renders/reorders.
const PALETTE = [
  { bg: "bg-violet-100", text: "text-violet-600" },
  { bg: "bg-emerald-100", text: "text-emerald-600" },
  { bg: "bg-sky-100", text: "text-sky-600" },
  { bg: "bg-amber-100", text: "text-amber-600" },
  { bg: "bg-rose-100", text: "text-rose-600" },
  { bg: "bg-teal-100", text: "text-teal-600" },
] as const;

export function getPersonColorClasses(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function getPersonInitial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}
