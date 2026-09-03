"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/screen/page-header";
import { WalletAccountsCard } from "./wallet-accounts-card";
import { WalletCardsCarousel } from "./wallet-cards-carousel";
import { WalletInvoicesRow } from "./wallet-invoices-row";
import { WalletInvestmentsRow } from "./wallet-investments-row";
import { WalletLoansRow } from "./wallet-loans-row";
import type { WalletOverview } from "../_types/types";

type WalletViewProps = {
  overview: WalletOverview;
};

export function WalletView({ overview }: WalletViewProps) {
  const t = useTranslations("scrn-wallet");

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-5">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <WalletAccountsCard overview={overview} />
      <WalletCardsCarousel overview={overview} />
      <WalletInvoicesRow overview={overview} />
      <WalletInvestmentsRow overview={overview} />
      <WalletLoansRow overview={overview} />
    </div>
  );
}
