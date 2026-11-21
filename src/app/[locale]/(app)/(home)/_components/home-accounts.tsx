"use client";

import { useTranslations } from "next-intl";
import { SectionCard, SectionLink } from "@/components/screen/section-card";
import { HOME_ACCOUNTS_LIMIT } from "../_constants/constants";
import { useHomeMoney } from "../_hooks/use-home-money";
import { AccountTile } from "./account-tile";
import type { HomeOverview } from "../_types/types";

type HomeAccountsProps = {
  accounts: HomeOverview["accounts"];
  balancesVisible: boolean;
  className?: string;
};

// "Minhas contas": up to four accounts as tiles in a two-column grid; the
// rest are one tap away through "Ver todas" (the count in the subtitle
// still covers every account).
export function HomeAccounts({ accounts, balancesVisible, className }: HomeAccountsProps) {
  const t = useTranslations("scrn-home.accounts");
  const money = useHomeMoney(balancesVisible);
  if (accounts.length === 0) return null;
  const shown = accounts.slice(0, HOME_ACCOUNTS_LIMIT);

  return (
    <SectionCard
      title={t("title")}
      description={t("subtitle", { count: accounts.length })}
      action={<SectionLink href="/accounts">{t("viewAll")}</SectionLink>}
      className={className}
      contentClassName="flex-1"
    >
      {/* Fills the card's height (it stretches to match the section beside
          it) with equal rows, instead of leaving empty space below. */}
      <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-3">
        {shown.map((account) => (
          <AccountTile key={account.id} account={account} money={money} />
        ))}
      </div>
    </SectionCard>
  );
}
