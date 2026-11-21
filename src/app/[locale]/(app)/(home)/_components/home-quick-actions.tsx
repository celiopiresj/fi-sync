"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { QUICK_ACTIONS } from "../_constants/constants";

// Phone layout: all four shortcuts always visible in one row (no
// scrolling), with compact icons and labels so they fit the narrowest
// phones.
export function HomeQuickActionsGrid() {
  const t = useTranslations("scrn-home.quickActions");

  return (
    <nav aria-label={t("title")} className="grid grid-cols-4 gap-2">
      {QUICK_ACTIONS.map((action) => (
        <Link
          key={action.label}
          href={action.href}
          className="group flex min-w-0 flex-col items-center gap-1 rounded-2xl border border-border/80 bg-card px-1 py-2 text-center shadow-xs transition-transform active:scale-95"
        >
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-lg transition-colors",
              action.primary
                ? "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                : "bg-secondary text-secondary-foreground group-hover:bg-primary/20",
            )}
          >
            <action.icon weight="bold" className="size-4" />
          </span>
          <span className="w-full text-[10px] leading-tight font-medium text-foreground">
            {t(action.label)}
          </span>
        </Link>
      ))}
    </nav>
  );
}

// Desktop layout: header buttons, the primary action last.
export function HomeHeaderActions() {
  const t = useTranslations("scrn-home.quickActions");

  return (
    <>
      {QUICK_ACTIONS.filter((action) => !action.primary).map((action) => (
        <Button key={action.label} variant="outline" asChild className="shadow-xs">
          <Link href={action.href}>
            <action.icon />
            {t(action.label)}
          </Link>
        </Button>
      ))}
      {QUICK_ACTIONS.filter((action) => action.primary).map((action) => (
        <Button key={action.label} asChild className="shadow-xs">
          <Link href={action.href}>
            <action.icon />
            {t(action.label)}
          </Link>
        </Button>
      ))}
    </>
  );
}
