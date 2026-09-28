"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowCircleDownIcon,
  ArrowCircleUpIcon,
  ChartLineUpIcon,
  DotsThreeIcon,
  PiggyBankIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageHeader } from "@/components/screen/page-header";
import { KpiCard, KpiGrid } from "@/components/screen/kpi-card";
import { AccountSheet } from "./form/account-sheet";
import { MovementSheet } from "./form/movement-sheet";
import { DeleteDialog } from "./delete-dialog";
import {
  investmentAccountTypeValues,
  type InvestmentAccountFormValues,
  type InvestmentAccountTypeOption,
  type InvestmentMovementFormValues,
  type InvestmentMovementKind,
} from "../_schema/schema";
import {
  createInvestmentAccount,
  createInvestmentMovement,
  deleteInvestmentAccount,
  toggleInvestmentAccountStatus,
  updateInvestmentAccount,
} from "../actions";
import { useInvestmentsData } from "../_hooks/use-investments-data";
import { getAccountColorClasses } from "../_lib/account-color";
import type {
  InvestmentAccountRow,
  MovementPersonOption,
  TransferAccountOption,
} from "../_types/types";

type DialogState =
  | { mode: "create"; type?: InvestmentAccountTypeOption }
  | { mode: "edit"; row: InvestmentAccountRow }
  | null;

type MovementState = { account: InvestmentAccountRow; kind: InvestmentMovementKind } | null;

const SECTION_ICON: Record<InvestmentAccountTypeOption, typeof ChartLineUpIcon> = {
  INVESTMENT: ChartLineUpIcon,
  POCKET: PiggyBankIcon,
};

type InvestmentsViewProps = {
  initialAccounts: InvestmentAccountRow[];
  transferAccounts: TransferAccountOption[];
  people: MovementPersonOption[];
};

export function InvestmentsView({
  initialAccounts,
  transferAccounts,
  people,
}: InvestmentsViewProps) {
  const t = useTranslations("scrn-investments");
  const tCommon = useTranslations("common");
  const format = useFormatter();

  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [movementState, setMovementState] = useState<MovementState>(null);
  const [deletingAccount, setDeletingAccount] = useState<InvestmentAccountRow | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const { accounts, invalidateInvestments } = useInvestmentsData(initialAccounts);

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  // Fixed INVESTMENT -> POCKET section order regardless of data; within a
  // section, active accounts first, then inactive (archived ones sink to
  // the bottom instead of interleaving) — same rule as accounts-view.tsx.
  const groups = useMemo(
    () =>
      investmentAccountTypeValues.map((type) => ({
        type,
        accounts: accounts
          .filter((account) => account.type === type)
          .sort((a, b) => {
            if (a.status !== b.status) {
              return a.status === "INACTIVE" ? 1 : -1;
            }
            return a.name.localeCompare(b.name);
          }),
      })),
    [accounts],
  );

  const { totalInvested, totalPockets, totalWealth } = useMemo(
    () =>
      accounts.reduce(
        (acc, account) => {
          if (account.type === "INVESTMENT") acc.totalInvested += account.balance;
          else acc.totalPockets += account.balance;
          acc.totalWealth += account.balance;
          return acc;
        },
        { totalInvested: 0, totalPockets: 0, totalWealth: 0 },
      ),
    [accounts],
  );

  async function handleSubmit(values: InvestmentAccountFormValues) {
    const isEditing = dialogState?.mode === "edit";
    const result = isEditing
      ? await updateInvestmentAccount(dialogState.row.id, values)
      : await createInvestmentAccount(values);

    if (!result.error) {
      invalidateInvestments();
      toast.success(t(isEditing ? "toast.updated" : "toast.created"));
    }

    return result;
  }

  async function handleToggleStatus(account: InvestmentAccountRow) {
    const wasActive = account.status === "ACTIVE";
    const result = await toggleInvestmentAccountStatus(account.id);
    if (!result.error) {
      invalidateInvestments();
      toast.success(t(wasActive ? "toast.archived" : "toast.reactivated"));
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingAccount) return;
    setIsDeleting(true);
    await deleteInvestmentAccount(deletingAccount.id);
    setIsDeleting(false);
    setDeletingAccount(null);
    invalidateInvestments();
    toast.success(t("toast.deleted"));
  }

  async function handleMovementSubmit(values: InvestmentMovementFormValues) {
    if (!movementState) return { error: "Not found" };
    const result = await createInvestmentMovement(movementState.account.id, values);

    if (!result.error) {
      invalidateInvestments();
      toast.success(t(`movement.toast.${values.kind.toLowerCase()}`));
    }

    return result;
  }

  const hasAccounts = accounts.length > 0;

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <PageHeader
        title={t("title")}
        subtitle={t("description")}
        right={
          <Button onClick={() => setDialogState({ mode: "create" })}>
            {t("buttons.add")}
          </Button>
        }
      />

      <KpiGrid columns={3}>
        <KpiCard label={t("kpis.totalInvested")} value={money(totalInvested)} />
        <KpiCard label={t("kpis.totalPockets")} value={money(totalPockets)} />
        <KpiCard
          label={t("kpis.totalWealth")}
          value={money(totalWealth)}
          tone="positive"
        />
      </KpiGrid>

      {!hasAccounts ? (
        <Empty className="border-none py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PiggyBankIcon />
            </EmptyMedia>
            <EmptyTitle>{t("empty.title")}</EmptyTitle>
            <EmptyDescription>{t("empty.description")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => setDialogState({ mode: "create" })}>
              {t("empty.button")}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => {
            const SectionIcon = SECTION_ICON[group.type];
            return (
              <div key={group.type} className="flex flex-col gap-3">
                <h2 className="text-sm font-medium text-muted-foreground">
                  {t(`fields.type.${group.type.toLowerCase()}`)}
                </h2>
                {group.accounts.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.accounts.map((account) => {
                      const color = getAccountColorClasses(account.id);
                      const balance = money(account.balance);
                      const canWithdraw = account.balance > 0;

                      return (
                        <Card
                          key={account.id}
                          className={
                            account.status === "INACTIVE"
                              ? "opacity-60"
                              : undefined
                          }
                        >
                          <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-base">
                              <span
                                className={cn(
                                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                                  color.bg,
                                )}
                              >
                                <SectionIcon
                                  weight="fill"
                                  className={cn("size-5", color.icon)}
                                />
                              </span>
                              {account.name}
                            </CardTitle>
                            <CardAction>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon-sm">
                                    <DotsThreeIcon />
                                    <span className="sr-only">
                                      {t("aria.menu")}
                                    </span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      setDialogState({
                                        mode: "edit",
                                        row: account,
                                      })
                                    }
                                  >
                                    {t("menu.edit")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() => handleToggleStatus(account)}
                                  >
                                    {t(
                                      account.status === "ACTIVE"
                                        ? "menu.archive"
                                        : "menu.reactivate",
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={() => setDeletingAccount(account)}
                                  >
                                    {t("menu.delete")}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </CardAction>
                          </CardHeader>
                          <CardContent className="flex flex-col gap-2">
                            <span
                              className="text-2xl font-semibold tabular-nums"
                              aria-label={`${t("fields.balance.label")}: ${balance}`}
                            >
                              {balance}
                            </span>
                            <Badge
                              variant={
                                account.status === "ACTIVE"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {tCommon(`status.${account.status.toLowerCase()}`)}
                            </Badge>
                          </CardContent>
                          <CardFooter className="flex flex-col gap-2">
                            <Button asChild variant="outline" size="sm" className="w-full">
                              <Link href={`/investments/${account.id}`}>
                                {t("card.viewHistory")}
                              </Link>
                            </Button>
                            <div className="grid w-full grid-cols-2 gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setMovementState({ account, kind: "CONTRIBUTION" })
                                }
                              >
                                <ArrowCircleUpIcon className="text-positive" />
                                {t("buttons.contribute")}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!canWithdraw}
                                onClick={() =>
                                  setMovementState({ account, kind: "WITHDRAWAL" })
                                }
                              >
                                <ArrowCircleDownIcon className="text-negative" />
                                {t("buttons.withdraw")}
                              </Button>
                            </div>
                          </CardFooter>
                        </Card>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() =>
                        setDialogState({ mode: "create", type: group.type })
                      }
                      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-8 text-muted-foreground transition-colors hover:bg-accent/50"
                    >
                      <PlusIcon className="size-5" />
                      <span className="text-sm">{t("buttons.addTile")}</span>
                    </button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                    {t(`empty.perType.${group.type.toLowerCase()}`)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AccountSheet
        open={dialogState !== null}
        onOpenChange={(open) => {
          if (!open) setDialogState(null);
        }}
        mode={dialogState?.mode ?? "create"}
        prefill={dialogState?.mode === "edit" ? dialogState.row : null}
        defaultType={
          dialogState?.mode === "create" ? dialogState.type : undefined
        }
        onSubmit={handleSubmit}
      />

      <MovementSheet
        open={movementState !== null}
        onOpenChange={(open) => {
          if (!open) setMovementState(null);
        }}
        accountId={movementState?.account.id ?? ""}
        accountBalance={movementState?.account.balance ?? 0}
        transferAccounts={transferAccounts}
        people={people}
        initialKind={movementState?.kind ?? "CONTRIBUTION"}
        onSubmit={handleMovementSubmit}
      />

      <DeleteDialog
        open={deletingAccount !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingAccount(null);
        }}
        onConfirm={handleDeleteConfirm}
        isPending={isDeleting}
      />
    </div>
  );
}
