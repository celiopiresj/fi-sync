"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link, usePathname } from "@/i18n/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { navSections, navItems } from "@/components/nav/nav-items";
import { LanguageSwitcher } from "@/components/nav/language-switcher";
import { ModeToggle } from "@/components/nav/mode-toggle";
import { UserMenu } from "@/components/nav/user-menu";

export function AppSidebar() {
  const t = useTranslations("common");

  const pathname = usePathname();

  // Picks the single longest-`href`-prefix match across every item
  // rather than letting each one check `pathname.startsWith(href)`
  // independently — keeps this correct if a future item's href ever
  // nests under another item's (e.g. two routes sharing a prefix), so a
  // deeper route doesn't highlight both entries at once.
  const activeHref = navItems.reduce<string | null>((best, item) => {
    const matches = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    if (!matches) return best;
    if (!best || item.href.length > best.length) return item.href;
    return best;
  }, null);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="py-4 flex items-center justify-center">
        <Link href="/">
          <Image
            src="/logo-full.png"
            alt="fi-sync logo"
            width={120}
            height={40}
            className="object-contain"
            priority
          />
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
                      {/* The active state's own bg/text (data-active:bg-
                          sidebar-accent etc., in sidebarMenuButtonVariants)
                          already comes from ui/sidebar.tsx — this just adds
                          the left border-bar accent on top of it (tasks/xxx
                          section 6). */}
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className="border-l-2 border-l-transparent data-active:border-l-sidebar-primary"
                      >
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

      <SidebarFooter>
        <ModeToggle />
        <LanguageSwitcher />
        <UserMenu />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
