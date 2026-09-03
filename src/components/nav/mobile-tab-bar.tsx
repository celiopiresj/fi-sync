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
// The center gap between the 2nd and 3rd tab is where MobileFab docks
// (rendered as a sibling by MobileNavShell, absolutely positioned — a
// 4-column grid's midpoint naturally falls between columns 2 and 3, so
// no extra spacing/margin bookkeeping is needed here).
export function MobileTabBar() {
  const t = useTranslations("common");
  const pathname = usePathname();

  const activeHref = resolveActiveHref(
    pathname,
    mobileTabItems.map((item) => item.href),
  );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-4 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label={t("aria.primaryNavigation")}
    >
      {mobileTabItems.map(({ href, labelKey, icon: Icon }) => {
        const isActive = href === activeHref;

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-muted-foreground",
              isActive && "text-primary",
            )}
          >
            <Icon weight={isActive ? "fill" : "regular"} className="size-5.5" />
            <span className="text-[10px] font-medium">{t(`nav.${labelKey}`)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
