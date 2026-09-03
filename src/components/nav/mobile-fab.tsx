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
export function MobileFab({ onClick }: MobileFabProps) {
  const t = useTranslations("common");

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("aria.addTransaction")}
      className={cn(
        "fixed bottom-9 left-1/2 z-40 flex size-14 -translate-x-1/2 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/40 md:hidden",
      )}
    >
      <PlusIcon weight="bold" className="size-6" />
    </button>
  );
}
