"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { resolveActiveHref } from "@/lib/nav/resolve-active-href";
import { mobileTabItems } from "@/components/nav/mobile-tab-items";

// Bottom tab bar, mobile only (md:hidden — CSS-only gate, never
// useIsMobile(), same hydration-mismatch precedent as
// transaction-mobile-list.tsx). Replaces the sidebar's off-canvas Sheet
// as the real mobile navigation surface — see (app)/layout.tsx, which
// hides SidebarTrigger below `md` so that Sheet never opens on a phone.
// Grid has 5 columns: 2 tabs on the left, an empty spacer in column 3
// where MobileFab docks, and 2 tabs on the right.
export function MobileTabBar() {
  const t = useTranslations("common");
  const pathname = usePathname();

  const activeHref = resolveActiveHref(
    pathname,
    mobileTabItems.map((item) => item.href),
  );

  const leftItems = mobileTabItems.slice(0, 2);
  const rightItems = mobileTabItems.slice(2);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-border/80 bg-background/85 backdrop-blur-md pb-[env(safe-area-inset-bottom)] shadow-xs md:hidden"
      aria-label={t("aria.primaryNavigation")}
    >
      {leftItems.map(({ href, labelKey, icon: Icon }) => {
        const isActive = href === activeHref;

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-muted-foreground transition-transform duration-150 active:scale-95",
              isActive && "text-primary font-semibold",
            )}
          >
            <Icon weight={isActive ? "fill" : "regular"} className="size-5.5" />
            <span className="text-[10px] tracking-tight">{t(`nav.${labelKey}`)}</span>
          </Link>
        );
      })}

      {/* Spacer column for center-docked MobileFab */}
      <div className="pointer-events-none" aria-hidden="true" />

      {rightItems.map(({ href, labelKey, icon: Icon }) => {
        const isActive = href === activeHref;

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-muted-foreground transition-transform duration-150 active:scale-95",
              isActive && "text-primary font-semibold",
            )}
          >
            <Icon weight={isActive ? "fill" : "regular"} className="size-5.5" />
            <span className="text-[10px] tracking-tight">{t(`nav.${labelKey}`)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
