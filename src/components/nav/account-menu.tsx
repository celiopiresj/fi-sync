"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { authClient } from "@/lib/auth/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { GlobeIcon, MoonIcon, SignOutIcon, SunIcon } from "@phosphor-icons/react";

const themeValues = ["light", "dark", "system"] as const;

function initialsFrom(value: string) {
  return value.slice(0, 2).toUpperCase();
}

// Single top-right account entry point (header, see (app)/layout.tsx) —
// avatar click opens session info + theme + language + sign out all in
// one place, same "one account menu, not three separate sidebar footer
// rows" pattern Google's own account switcher uses. Replaces the old
// ModeToggle/LanguageSwitcher/UserMenu trio that used to sit in the
// sidebar footer.
export function AccountMenu() {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isLocalePending, startLocaleTransition] = useTransition();
  const { theme, setTheme } = useTheme();
  const { data: session, isPending: isSessionPending } = authClient.useSession();

  // Both `theme` (next-themes) and the session are only knowable after
  // mount (localStorage/matchMedia and the auth cookie aren't available
  // during SSR) — server render and the client's first render must agree,
  // or React throws a hydration mismatch. Same guard both ModeToggle and
  // UserMenu used to apply separately.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const activeTheme = mounted ? (theme ?? "system") : "system";
  const email = mounted ? (session?.user?.email ?? "") : "";
  const name = mounted ? (session?.user?.name ?? email) : "";

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/auth/sign-in");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={!mounted || isSessionPending}
          className="rounded-full"
        >
          <Avatar size="sm">
            <AvatarFallback>{name ? initialsFrom(name) : ""}</AvatarFallback>
          </Avatar>
          <span className="sr-only">{t("userMenu.open")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {email && (
          <>
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{name}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">
                {email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {activeTheme === "dark" ? <MoonIcon /> : <SunIcon />}
            {t("userMenu.theme")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={activeTheme} onValueChange={setTheme}>
              {themeValues.map((value) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {t(`theme.${value}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <GlobeIcon />
            {t("userMenu.language")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={locale}
              onValueChange={(nextLocale) => {
                startLocaleTransition(() => {
                  router.replace(pathname, { locale: nextLocale });
                });
              }}
            >
              {routing.locales.map((nextLocale) => (
                <DropdownMenuRadioItem
                  key={nextLocale}
                  value={nextLocale}
                  disabled={isLocalePending}
                >
                  {t(`language.${nextLocale}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={handleSignOut}>
          <SignOutIcon />
          {t("userMenu.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
