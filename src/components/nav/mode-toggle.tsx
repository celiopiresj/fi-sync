"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { SunIcon, MoonIcon } from "@phosphor-icons/react";

const themeValues = ["light", "dark", "system"] as const;

export function ModeToggle() {
  const t = useTranslations("common");
  const { theme, setTheme } = useTheme();

  // `theme` is only knowable after mount — next-themes resolves it from
  // localStorage/matchMedia, neither available during SSR — so the server
  // render and the client's first render must both fall back to the same
  // "system" placeholder. Only switch to the real value once mounted, or
  // the label/icon disagree between server and client and React throws a
  // hydration error.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const activeTheme = mounted ? (theme ?? "system") : "system";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton>
              {activeTheme === "dark" ? <MoonIcon /> : <SunIcon />}
              <span>{t(`theme.${activeTheme}`)}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-48"
          >
            {themeValues.map((value) => (
              <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
                {t(`theme.${value}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
