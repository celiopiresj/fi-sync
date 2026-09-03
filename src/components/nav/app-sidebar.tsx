"use client";

import { navItems, navSections } from "@/components/nav/nav-items";
import { resolveActiveHref } from "@/lib/nav/resolve-active-href";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";

export function AppSidebar() {
  const t = useTranslations("common");

  const pathname = usePathname();

  const activeHref = resolveActiveHref(
    pathname,
    navItems.map((item) => item.href),
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="py-4">
        {/* Icon and wordmark as two separate elements (not the flat
            logo-full.png used before) specifically so the icon badge can
            keep showing on its own once the sidebar collapses to icon-
            only mode — group-data-[collapsible=icon]:hidden is the same
            pattern every other text-bearing sidebar element already uses
            (see components/ui/sidebar.tsx) to disappear in that state.
            `overflow-hidden` on this row + `whitespace-nowrap` on the
            text: the `hidden` class above toggles instantly (no
            transition) while the sidebar's own width animates over
            200ms (see that file's `transition-[left,right,width]`), so
            for a moment the text is fully visible inside a still-narrow
            container — without these, that forces a visible wrap-then-
            unwrap (and the icon shifting alongside it) until the width
            catches up; clipping instead of wrapping makes that
            transitional moment invisible. */}
        <Link href="/" className="flex items-center gap-2 overflow-hidden">
          <Image
            src="/logo-icon.png"
            alt="fi-sync logo"
            width={28}
            height={28}
            // Tailwind's preflight also sets `img { max-width: 100% }` —
            // when the sidebar collapses to its icon-only width (3rem,
            // and this row eats into that with its own padding on top),
            // the *available* width drops below 28px, and max-width caps
            // the image down to whatever's left while `size-7`'s height
            // stays pinned at 28px (utilities layer already beats
            // preflight for that half, same fix logo-full.png's own
            // comment used to describe) — the combination squashed the
            // icon into a lopsided, non-square box instead of just
            // staying 28x28 and letting `overflow-hidden` on the row
            // above clip whatever doesn't fit. `max-w-none` cancels
            // preflight's max-width so `size-7` is the only thing
            // governing both dimensions, same as the other one.
            className="size-7 max-w-none shrink-0 object-contain"
            priority
          />
          <span className="truncate text-lg font-semibold whitespace-nowrap group-data-[collapsible=icon]:hidden">
            Fi-sync
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {navSections.map((section) => (
          <SidebarGroup key={section.labelKey}>
            <SidebarGroupLabel className="text-[11px]">
              {t(`nav.sections.${section.labelKey}`)}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map(({ href, labelKey, icon: Icon }) => {
                  const isActive = href === activeHref;

                  return (
                    <SidebarMenuItem key={href}>
                      {/* Overrides the base component's own hover/active
                          colors (ui/sidebar.tsx's sidebarMenuButtonVariants
                          default to --sidebar-accent/--sidebar-primary,
                          tinted blue — see those tokens' own comments in
                          globals.css) with the app's real brand color
                          instead: hover gets a plain neutral gray (a blue
                          hover reads as "this is now selected," not just
                          "your cursor is here"), and the active item uses
                          --primary (the same teal used everywhere else in
                          the app for "the main/selected thing") — a
                          translucent tint for the background rather than a
                          solid block, same "10% opacity" convention this
                          app already uses for --positive/--warning status
                          coloring, so the row stays readable instead of a
                          heavy color slab. `cn()` in the base component
                          merges same-purpose utilities (last wins), so
                          each of these only touches its own state. */}
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className="border-l-2 border-l-transparent hover:bg-muted hover:text-foreground data-active:border-l-primary data-active:bg-primary/10 data-active:text-primary">
                        <Link href={href}>
                          <Icon />
                          <span>{t(`nav.${labelKey}`)}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
