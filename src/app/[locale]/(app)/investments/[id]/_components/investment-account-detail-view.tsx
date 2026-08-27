"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, Link } from "@/i18n/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, ChartLineUpIcon, PiggyBankIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard, KpiGrid } from "@/components/screen/kpi-card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { DATE_ONLY_FORMAT_OPTIONS } from "@/lib/date";
import { MovementSheet } from "../../_components/form/movement-sheet";
import { createInvestmentMovement } from "../../actions";
import { getAccountColorClasses } from "../../_lib/account-color";
import type {
  InvestmentAccountDetail,
  InvestmentMovementRow,
} from "../../_types/types";
import type {
  InvestmentMovementFormValues,
  InvestmentMovementKind,
} from "../../_schema/schema";

type MovementDialogState = { kind: InvestmentMovementKind } | null;

type InvestmentAccountDetailViewProps = {
  account: InvestmentAccountDetail;
};

export function InvestmentAccountDetailView({
  account,
}: InvestmentAccountDetailViewProps) {
  const t = useTranslations("scrn-investments");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [movementDialog, setMovementDialog] = useState<MovementDialogState>(null);

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  // No dedicated hook for this one-off invalidation — this page has no
  // list query of its own to own the queryClient for, same reasoning as
  // invoice-detail-view.tsx's own handlePaid. Just needs the /investments
  // list card (balance) to refetch, plus re-render this Server Component
  // (router.refresh()) so `account.balance`/`movements` reflect the
  // just-saved state without a full navigation.
  function handleMoved() {
    queryClient.invalidateQueries({ queryKey: ["investment-accounts"] });
    router.refresh();
  }

  async function handleMovementSubmit(values: InvestmentMovementFormValues) {
    const result = await createInvestmentMovement(account.id, values);
    if (!result.error) {
      handleMoved();
      toast.success(t(`movement.toast.${values.kind.toLowerCase()}`));
    }
    return result;
  }

  const Icon = account.type === "INVESTMENT" ? ChartLineUpIcon : PiggyBankIcon;
  const color = getAccountColorClasses(account.id);
  const canWithdraw = account.balance > 0;

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <Link
        href="/investments"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("detail.back")}
      </Link>

      <div className="flex flex-col gap-4 rounded-lg bg-surface-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                color.bg,
              )}
            >
              <Icon weight="fill" className={cn("size-5", color.icon)} />
            </span>
            <h1 className="text-xl font-semibold">{account.name}</h1>
          </div>
          <Badge variant={account.status === "ACTIVE" ? "default" : "secondary"}>
            {tCommon(`status.${account.status.toLowerCase()}`)}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMovementDialog({ kind: "CONTRIBUTION" })}
          >
            {t("buttons.contribute")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!canWithdraw}
            onClick={() => setMovementDialog({ kind: "WITHDRAWAL" })}
          >
            {t("buttons.withdraw")}
          </Button>
        </div>
      </div>

      <KpiGrid columns={3}>
        <KpiCard label={t("fields.balance.label")} value={money(account.balance)} />
        <KpiCard
          label={t("detail.kpis.yieldLastMonth")}
          value={money(account.yieldLastMonth)}
          tone={account.yieldLastMonth >= 0 ? "positive" : "negative"}
        />
        <KpiCard
          label={t("detail.kpis.yieldTotal")}
          value={money(account.yieldTotal)}
          tone={account.yieldTotal >= 0 ? "positive" : "negative"}
        />
      </KpiGrid>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{t("detail.movements.title")}</h2>

        {account.movements.length === 0 ? (
          <Empty className="rounded-md border border-dashed border-border py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon />
              </EmptyMedia>
              <EmptyTitle>{t("detail.movements.empty")}</EmptyTitle>
              <EmptyDescription>{t("empty.description")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="rounded-md border border-border">
            <div className="divide-y divide-border">
              {account.movements.map((movement) => (
                <MovementRow key={movement.id} movement={movement} money={money} />
              ))}
            </div>
          </div>
        )}
      </div>

      <MovementSheet
        open={movementDialog !== null}
        onOpenChange={(open) => {
          if (!open) setMovementDialog(null);
        }}
        accountId={account.id}
        accountBalance={account.balance}
        initialKind={movementDialog?.kind ?? "CONTRIBUTION"}
        onSubmit={handleMovementSubmit}
      />
    </div>
  );
}

function MovementRow({
  movement,
  money,
}: {
  movement: InvestmentMovementRow;
  money: (value: number) => string;
}) {
  const t = useTranslations("scrn-investments");
  const format = useFormatter();

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="min-w-0 truncate text-sm font-medium">
          {movement.description}
        </span>
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="shrink-0">
            {t(`movement.fields.kind.${movement.kind.toLowerCase()}`)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {format.dateTime(movement.date, DATE_ONLY_FORMAT_OPTIONS)}
          </span>
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 text-sm font-medium tabular-nums",
          movement.amount < 0 ? "text-negative" : "text-positive",
        )}
      >
        {money(movement.amount)}
      </span>
    </div>
  );
}
