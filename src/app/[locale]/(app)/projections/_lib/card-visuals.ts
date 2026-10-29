import { AVAILABLE_COLORS } from "@/components/form/color-picker";

export function cleanCardName(rawName: string): string {
  const cleaned = rawName
    .replace(/^pagamento\s+(da\s+|de\s+)?fatura(\s+do\s+cart[aã]o|\s+de|\s+do|\s+da)?\s*/i, "")
    .replace(/^fatura(\s+do\s+cart[aã]o|\s+de|\s+do|\s+da)?\s*/i, "")
    .trim();
  return cleaned.length > 0 ? cleaned : rawName;
}

export function getCardInitials(name: string): string {
  const clean = cleanCardName(name);
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const first = words[0]!;
    const second = words[1]!;
    if (first.length === 2) {
      return first.toUpperCase();
    }
    return (first[0]! + second[0]!).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

export function resolveCardBadgeStyle(
  colorStyle: string | null | undefined,
  name: string,
) {
  const cleanName = cleanCardName(name);
  const initials = getCardInitials(cleanName);
  const match = AVAILABLE_COLORS.find(
    (c) => c.class === colorStyle || c.name === colorStyle,
  );

  if (match) {
    return {
      logoBg: `${match.badgeClass} text-white`,
      badge: `${match.class} border-transparent`,
      bar: match.badgeClass,
      initials,
      cleanName,
    };
  }

  return {
    logoBg: "bg-foreground text-background",
    badge: "bg-muted text-muted-foreground border-border",
    bar: "bg-foreground",
    initials,
    cleanName,
  };
}

