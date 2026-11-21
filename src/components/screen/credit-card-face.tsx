"use client";

import { useTranslations } from "next-intl";
import { CreditCardIcon } from "@phosphor-icons/react";
import { resolveTileHeaderClass } from "@/lib/card-color";
import { cn } from "@/lib/utils";

type CreditCardFaceProps = {
  name: string;
  colorStyle: string | null;
  closingDay: number | null;
  dueDay: number | null;
  className?: string;
};

// A credit card drawn as a physical card, in the color the user picked
// for it: a card icon on top, the card's name at the bottom left and its
// closing and due days at the bottom right (more useful in a finance app
// than an expiry date or CVV).
export function CreditCardFace({
  name,
  colorStyle,
  closingDay,
  dueDay,
  className,
}: CreditCardFaceProps) {
  const t = useTranslations("common.creditCard");

  return (
    <div
      className={cn(
        "relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-2xl p-4 shadow-md",
        resolveTileHeaderClass(colorStyle),
        className,
      )}
    >
      {/* Soft sheen so a flat color reads as a card surface. */}
      <span className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/20 via-transparent to-black/10" />

      <CreditCardIcon weight="fill" className="relative size-6 opacity-90" />

      <div className="relative flex items-end justify-between gap-3 text-xs">
        <span className="min-w-0 break-words text-base font-bold tracking-wide uppercase">
          {name}
        </span>
        {/* Both days in one stacked column: the line keeps two items. */}
        <span className="flex shrink-0 flex-col items-end gap-0.5 font-medium tabular-nums">
          {closingDay !== null && <span>{t("closesOn", { day: closingDay })}</span>}
          {dueDay !== null && <span>{t("dueOn", { day: dueDay })}</span>}
        </span>
      </div>
    </div>
  );
}
