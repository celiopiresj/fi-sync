import { AVAILABLE_COLORS } from "@/components/form/color-picker";

// Category.colorStyle is stored as ColorPicker's own light "badge" class
// (bg-orange-100/text-orange-600) — good for an icon badge, too pastel
// for a progress-bar fill. Resolves the same user-chosen color back to
// its bold `badgeClass` (bg-orange-500) for the bar, reusing the one
// color already picked rather than inventing a second palette — same
// technique cards/_lib/card-tile-color.ts already uses for its own tile
// header. No match (color never set, or a category without one) falls
// back to a neutral gray for both.
export function resolveCategoryColorClasses(colorStyle: string | null): {
  badge: string;
  bar: string;
} {
  const match = AVAILABLE_COLORS.find((color) => color.class === colorStyle);
  return {
    badge: match?.class ?? "bg-muted text-muted-foreground",
    bar: match?.badgeClass ?? "bg-muted-foreground",
  };
}
