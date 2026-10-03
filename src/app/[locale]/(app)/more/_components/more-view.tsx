"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { usePathname, useRouter, Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { authClient } from "@/lib/auth/client";
import { PageHeader } from "@/components/screen/page-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CalculatorIcon,
  CaretRightIcon,
  ChartBarIcon,
  ChartPieSliceIcon,
  ArrowsClockwiseIcon,
  GlobeIcon,
  MoonIcon,
  SignOutIcon,
  SunIcon,
  TagIcon,
  TelegramLogoIcon,
  TrendUpIcon,
  UsersThreeIcon,
  type IconProps,
} from "@phosphor-icons/react";
import type { ComponentType, ReactNode } from "react";
import type { MoreOverview } from "../_types/types";

const themeValues = ["light", "dark", "system"] as const;

type RowProps = {
  icon: ComponentType<IconProps>;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
};

function RowIcon({ icon: Icon }: { icon: ComponentType<IconProps> }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
      <Icon className="size-4" />
    </span>
  );
}

function RowContent({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="text-sm font-medium">{title}</span>
      {subtitle && <span className="truncate text-xs text-muted-foreground">{subtitle}</span>}
    </div>
  );
}

function NavRow({ icon, title, subtitle, href }: RowProps & { href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3">
      <RowIcon icon={icon} />
      <RowContent title={title} subtitle={subtitle} />
      <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

type MoreViewProps = {
  overview: MoreOverview;
};

export function MoreView({ overview }: MoreViewProps) {
  const t = useTranslations("scrn-more");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // theme/locale are only knowable after mount — see AccountMenu's own
  // comment for why this guard exists (server/client must agree on the
  // first render or React throws a hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  const activeTheme = mounted ? (theme ?? "system") : "system";

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/auth/sign-in");
  }

  const recurrencesSubtitle = [
    t("rows.recurrences.active", { count: overview.activeRecurrencesCount }),
    overview.recurrencesNeedingExtensionCount > 0
      ? t("rows.recurrences.needsExtension", {
          count: overview.recurrencesNeedingExtensionCount,
        })
      : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-5">
      <PageHeader title={t("title")} />

      <div className="flex flex-col gap-2">
        <span className="px-1 text-xs font-medium text-muted-foreground uppercase">
          {t("groups.planning")}
        </span>
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
          <NavRow
            icon={ChartPieSliceIcon}
            title={t("rows.budgets.title")}
            subtitle={t("rows.budgets.subtitle", { count: overview.overBudgetCount })}
            href="/budgets"
          />
          <NavRow icon={TrendUpIcon} title={t("rows.projections.title")} href="/projections" />
          <NavRow icon={ChartBarIcon} title={t("rows.spending.title")} href="/spending" />
          <NavRow
            icon={CalculatorIcon}
            title={t("rows.cardPayoff.title")}
            subtitle={t("rows.cardPayoff.subtitle")}
            href="/cards/payoff"
          />
          <NavRow
            icon={ArrowsClockwiseIcon}
            title={t("rows.recurrences.title")}
            subtitle={recurrencesSubtitle}
            href="/recurrences"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="px-1 text-xs font-medium text-muted-foreground uppercase">
          {t("groups.records")}
        </span>
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
          <NavRow icon={TagIcon} title={t("rows.categories.title")} href="/categories" />
          <NavRow icon={UsersThreeIcon} title={t("rows.people.title")} href="/people" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="px-1 text-xs font-medium text-muted-foreground uppercase">
          {t("groups.account")}
        </span>
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
          <NavRow
            icon={TelegramLogoIcon}
            title={t("rows.telegram.title")}
            subtitle={t("rows.telegram.subtitle")}
            href="/telegram"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={!mounted}>
              <button type="button" className="flex w-full items-center gap-3 px-4 py-3">
                <RowIcon icon={activeTheme === "dark" ? MoonIcon : SunIcon} />
                <RowContent title={t("rows.theme.title")} />
                <span className="shrink-0 text-xs text-muted-foreground">
                  {tCommon(`theme.${activeTheme}`)}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={activeTheme} onValueChange={setTheme}>
                {themeValues.map((value) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {tCommon(`theme.${value}`)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex w-full items-center gap-3 px-4 py-3">
                <RowIcon icon={GlobeIcon} />
                <RowContent title={t("rows.language.title")} />
                <span className="shrink-0 text-xs text-muted-foreground">
                  {tCommon(`language.${locale}`)}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={locale}
                onValueChange={(nextLocale) => router.replace(pathname, { locale: nextLocale })}
              >
                {routing.locales.map((nextLocale) => (
                  <DropdownMenuRadioItem key={nextLocale} value={nextLocale}>
                    {tCommon(`language.${nextLocale}`)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 px-4 py-3 text-negative"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-negative/10 text-negative">
              <SignOutIcon className="size-4" />
            </span>
            <span className="flex-1 text-left text-sm font-medium">{t("rows.signOut.title")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
