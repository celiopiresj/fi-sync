// Rotating, meaning-free fallback avatar color, same spirit as
// getAccountColorClasses (accounts/_lib/account-color.ts) but hashed off
// the name instead of the id — only used for a Person row created before
// Person.colorStyle existed (or otherwise still null). Every person
// created/edited through PersonForm now has an explicit `colorStyle`
// (Category/Card's own AVAILABLE_COLORS palette, see color-picker.tsx),
// which always wins when present.
const FALLBACK_PALETTE = [
  "bg-violet-100 text-violet-600",
  "bg-emerald-100 text-emerald-600",
  "bg-sky-100 text-sky-600",
  "bg-amber-100 text-amber-600",
  "bg-rose-100 text-rose-600",
  "bg-teal-100 text-teal-600",
] as const;

export function getPersonColorClasses(
  name: string,
  colorStyle?: string | null,
): string {
  if (colorStyle) return colorStyle;

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}

export function getPersonInitial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}
