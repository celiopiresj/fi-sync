"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeftIcon,
  BankIcon,
  CaretRightIcon,
  SwapIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { KpiCard, KpiGrid } from "@/components/screen/kpi-card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { getAccountColorClasses } from "../../_lib/account-color";
import {
  getPersonColorClasses,
  getPersonInitial,
} from "../../../people/_lib/person-avatar";
import { useQuickAddTransactionOptions } from "@/hooks/use-quick-add-transaction-options";
import { useQuickAddTransactionMutations } from "@/hooks/use-quick-add-transaction-mutations";
import { TransferSheet } from "../../../transactions/_components/form/transfer-sheet";
import type { AccountDetail, AccountPersonBalance } from "../_types/types";

type AccountDetailViewProps = {
  account: AccountDetail;
};

export function AccountDetailView({ account }: AccountDetailViewProps) {
  const t = useTranslations("scrn-accounts");
  const tCommon = useTranslations("common");
  const format = useFormatter();

  const [transferOpen, setTransferOpen] = useState(false);
  // Fetched as soon as the screen loads, not on click: this is the screen
  // you come to in order to DO something with an account, and the sheet
  // reads its pickers from these — waiting for the query after the click
  // would open it empty for a beat.
  const { data: transferOptions } = useQuickAddTransactionOptions(true);
  const { submitTransfer } = useQuickAddTransactionMutations();

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  const color = getAccountColorClasses(account.id);

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <Link
        href="/accounts"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("detail.back")}
      </Link>

      {/* Wraps the status/transfer controls onto their own line on a
          phone instead of squeezing the account name into a narrow
          column beside them. */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-surface-1 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              color.bg,
            )}
          >
            <BankIcon weight="fill" className={cn("size-5", color.icon)} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="text-xl font-semibold">{account.name}</h1>
            <span className="text-sm text-muted-foreground">
              {t(`fields.type.${account.type.toLowerCase()}`)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={account.status === "ACTIVE" ? "default" : "secondary"}>
            {tCommon(`status.${account.status.toLowerCase()}`)}
          </Badge>
          {/* Nothing in the account means nothing to move. */}
          {account.balance !== 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTransferOpen(true)}
            >
              <SwapIcon />
              {t("detail.transferBalance")}
            </Button>
          )}
        </div>
      </div>

      <KpiGrid columns={2}>
        <KpiCard
          label={t("detail.kpis.balance")}
          value={money(account.balance)}
          tone={account.balance < 0 ? "negative" : "positive"}
        />
        <KpiCard
          label={t("detail.kpis.people")}
          value={account.people.length}
          icon={<UsersIcon className="size-5" />}
        />
      </KpiGrid>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-medium">{t("detail.people.title")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("detail.people.description")}
          </p>
        </div>

        {account.people.length === 0 ? (
          <Empty className="rounded-md border border-dashed border-border py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersIcon />
              </EmptyMedia>
              <EmptyTitle>{t("detail.people.empty.title")}</EmptyTitle>
              <EmptyDescription>
                {t("detail.people.empty.description")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="rounded-md border border-border">
            <div className="divide-y divide-border">
              {account.people.map((row) => (
                <PersonBalanceRow
                  key={row.personId ?? "unattributed"}
                  accountId={account.id}
                  row={row}
                  money={money}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      {transferOptions && (
        // Opens straight on "saldo da conta" with this account as the
        // source — the two typed shapes are still one toggle away.
        <TransferSheet
          open={transferOpen}
          onOpenChange={setTransferOpen}
          accounts={transferOptions.accounts}
          categories={transferOptions.categories}
          people={transferOptions.people}
          defaultAccountId={account.id}
          initialTarget="balance"
          onSubmit={submitTransfer}
        />
      )}
    </div>
  );
}

function PersonBalanceRow({
  accountId,
  row,
  money,
}: {
  accountId: string;
  row: AccountPersonBalance;
  money: (value: number) => string;
}) {
  const t = useTranslations("scrn-accounts");

  const name = row.personId ? row.name : t("detail.people.unattributed");

  const content = (
    <>
      <Avatar>
        <AvatarFallback className={getPersonColorClasses(name, row.colorStyle)}>
          {getPersonInitial(name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-medium">{name}</span>
          {row.isSelf && (
            <Badge variant="secondary">{t("detail.people.selfBadge")}</Badge>
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("detail.people.transactionsCount", {
            count: row.transactionsCount,
          })}
        </span>
      </div>
      <span
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          row.balance < 0 ? "text-negative" : "text-positive",
        )}
      >
        {money(row.balance)}
      </span>
    </>
  );

  // A row without a person id is money the breakdown couldn't attribute
  // to anyone (see getAccountDetail's own comment) — there's no person
  // filter to link it to, so it renders as plain text instead.
  if (!row.personId) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5">{content}</div>
    );
  }

  return (
    <Link
      href={{
        pathname: "/transactions",
        query: { account: accountId, person: row.personId },
      }}
      aria-label={t("detail.people.viewTransactions", { name })}
      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50"
    >
      {content}
      <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
