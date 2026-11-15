"use client";

import { useTranslations } from "next-intl";
import { PlusIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type MobileFabProps = {
  onClick: () => void;
};

// Center-docked "add transaction" button, mobile only (md:hidden). Sits
// above MobileTabBar (rendered as a sibling by MobileNavShell), centered
// over the natural gap between the bar's 2nd and 3rd tab.
// above MobileTabBar (rendered as a sibling by MobileNavShell), perfectly
// docked into the 5-column tab bar's center column with a clean ring cutout.
export function MobileFab({ onClick }: MobileFabProps) {
  const t = useTranslations("common");

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("aria.addTransaction")}
      className={cn(
        "fixed bottom-9 left-1/2 z-40 flex size-14 -translate-x-1/2 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 border border-primary-foreground/10 transition-transform duration-150 active:scale-95 md:hidden",
        "fixed bottom-[calc(1.125rem+env(safe-area-inset-bottom,0px))] left-1/2 z-50 flex size-12 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background transition-transform duration-150 active:scale-95 md:hidden",
      )}
    >
      <PlusIcon weight="bold" className="size-6" />
    </button>
  );
}
