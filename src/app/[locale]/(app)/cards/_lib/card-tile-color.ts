import { AVAILABLE_COLORS } from "@/components/form/color-picker";

// The wallet-style card tile (AllCardsSection) needs a bold, solid
// header background — ColorPicker's own `class` (a light badge style:
// bg-orange-100/text-orange-600) is too pastel for that, so this
// resolves the same user-chosen color back to its bold `badgeClass`
// (bg-orange-500) instead, reusing the one color the user actually
// picked rather than inventing a second palette. No match (color never
// set) falls back to a neutral dark tile, same treatment CardChip gives
// an uncolored card's identification chip.
export function resolveTileHeaderClass(colorStyle: string | null): string {
  const match = AVAILABLE_COLORS.find((color) => color.class === colorStyle);
  return match ? `${match.badgeClass} text-white` : "bg-foreground text-background";
}
