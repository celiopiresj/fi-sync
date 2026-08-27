"use client";

import { useTranslations } from "next-intl";
import { WarningIcon } from "@phosphor-icons/react";
import type { CreditCardAccountRow } from "../_types/types";
import { AttentionCard } from "./attention-card";

type AttentionSectionProps = {
  accounts: CreditCardAccountRow[];
  onEdit: (id: string) => void;
  onToggleStatus: (account: CreditCardAccountRow) => void;
  onDelete: (account: CreditCardAccountRow) => void;
};

// Disappears entirely (no heading, no empty card) when nothing crosses
// the 95% usage threshold — the whole point of this section is to
// surface only what needs attention right now.
export function AttentionSection({
  accounts,
  onEdit,
  onToggleStatus,
  onDelete,
}: AttentionSectionProps) {
  const t = useTranslations("scrn-cards");

  if (accounts.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-negative">
        <span className="size-2 shrink-0 rounded-full bg-negative" />
        <WarningIcon className="size-4 shrink-0" />
        {t("sections.attention.title", { count: accounts.length })}
      </h2>
      <div className="flex flex-wrap gap-3">
        {accounts.map((account) => (
          <AttentionCard
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
