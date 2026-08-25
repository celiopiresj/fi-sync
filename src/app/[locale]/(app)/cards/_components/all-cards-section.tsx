"use client";

import { useTranslations } from "next-intl";
import type { CreditCardAccountRow } from "../_types/types";
import { CardRow } from "./card-row";

type AllCardsSectionProps = {
  accounts: CreditCardAccountRow[];
  onEdit: (id: string) => void;
  onToggleStatus: (account: CreditCardAccountRow) => void;
  onDelete: (account: CreditCardAccountRow) => void;
};

// Every account below the 95% attention threshold — hidden entirely if
// every account happens to be critical right now, same "no empty
// section heading" rule as AttentionSection.
export function AllCardsSection({
  accounts,
  onEdit,
  onToggleStatus,
  onDelete,
}: AllCardsSectionProps) {
  const t = useTranslations("scrn-cards");

  if (accounts.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">{t("sections.all.title")}</h2>
      <div className="flex w-full flex-col divide-y-[0.5px] divide-border rounded-lg bg-surface-1 px-4">
        {accounts.map((account) => (
          <CardRow
            key={account.id}
            account={account}
            onEdit={() => onEdit(account.id)}
            onToggleStatus={onToggleStatus}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
