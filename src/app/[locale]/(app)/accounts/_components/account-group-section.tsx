"use client";

import { useTranslations } from "next-intl";
import { PlusIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
} from "@/components/ui/empty";
import { SectionCard } from "@/components/screen/section-card";
import { AccountCard } from "./account-card";
import type { AccountTypeOption } from "../_schema/schema";
import type { AccountGroup, AccountRow } from "../_types/types";

type AccountGroupSectionProps = {
  group: AccountGroup;
  onAdd: (type: AccountTypeOption) => void;
  onEdit: (account: AccountRow) => void;
  onToggleDefault: (account: AccountRow) => void;
  onToggleStatus: (account: AccountRow) => void;
  onDelete: (account: AccountRow) => void;
};

// One account type as a home-style SectionCard: the type and its count
// in the header, "Adicionar" (preselecting this type in the form) as the
// header action, and the accounts as tiles. One tile per row on a phone,
// then 2 / 3 / 4 columns as the content area widens.
export function AccountGroupSection({
  group,
  onAdd,
  onEdit,
  onToggleDefault,
  onToggleStatus,
  onDelete,
}: AccountGroupSectionProps) {
  const t = useTranslations("scrn-accounts");
  const typeKey = group.type.toLowerCase();
  const typeLabel = t(`fields.type.${typeKey}`);

  return (
    <SectionCard
      title={typeLabel}
      description={t("cards.groupCount", { count: group.accounts.length })}
      action={
        <Button
          variant="ghost"
          size="sm"
          className="-my-2 h-11 md:my-0 md:h-8"
          aria-label={t("aria.addToType", { type: typeLabel })}
          onClick={() => onAdd(group.type)}
        >
          <PlusIcon aria-hidden="true" />
          {t("buttons.addShort")}
        </Button>
      }
    >
      {group.accounts.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {group.accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={onEdit}
              onToggleDefault={onToggleDefault}
              onToggleStatus={onToggleStatus}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        <Empty className="border border-border/80 p-4">
          <EmptyHeader>
            <EmptyDescription>{t(`empty.perType.${typeKey}`)}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </SectionCard>
  );
}
