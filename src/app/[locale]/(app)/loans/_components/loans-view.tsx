"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { DotsThreeIcon, HandCoinsIcon, PlusIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/screen/page-header";
import { KpiCard, KpiGrid } from "@/components/screen/kpi-card";
import { SearchInput } from "@/components/screen/search-input";
import { Link } from "@/i18n/navigation";
import { DATE_ONLY_FORMAT_OPTIONS } from "@/lib/date";
import { LoanSheet } from "./form/loan-sheet";
import { DeleteDialog } from "./delete-dialog";
import { LoanStatusBadge, loanStatusMessageKey } from "./loan-status-badge";
import { createLoan, deleteLoan, updateLoan, type LoanFilters } from "../actions";
import type { LoanFormValues } from "../_schema/schema";
import { useLoansData } from "../_hooks/use-loans-data";
import type { LoanAccountOption, LoanPersonOption, LoanRow } from "../_types/types";

const ALL_VALUE = "__all__";

type DialogState = { mode: "create" } | { mode: "edit"; row: LoanRow } | null;

type LoansViewProps = {
  initialLoans: LoanRow[];
  people: LoanPersonOption[];
  accounts: LoanAccountOption[];
};

export function LoansView({ initialLoans, people, accounts }: LoansViewProps) {
  const t = useTranslations("scrn-loans");
  const format = useFormatter();

  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [deletingLoan, setDeletingLoan] = useState<LoanRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [personId, setPersonId] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState("");

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  const filters: LoanFilters = useMemo(() => ({ personId }), [personId]);
  const isDefaultFilters = !personId;

  const { loans, invalidate } = useLoansData(filters, initialLoans, isDefaultFilters);

  const { totalRemaining, overdueCount, settledCount } = useMemo(
    () =>
      loans.reduce(
        (acc, loan) => {
          acc.totalRemaining += loan.remainingTotal;
          if (loan.overdueCount > 0) acc.overdueCount += 1;
          if (loan.status === "SETTLED") acc.settledCount += 1;
          return acc;
        },
        { totalRemaining: 0, overdueCount: 0, settledCount: 0 },
      ),
    [loans],
  );

  const filteredLoans = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return loans;
    return loans.filter(
      (loan) =>
        loan.description.toLowerCase().includes(query) ||
        loan.person.name.toLowerCase().includes(query),
    );
  }, [loans, searchText]);

  async function handleSubmit(values: LoanFormValues) {
    const isEditing = dialogState?.mode === "edit";
    const result = isEditing
      ? await updateLoan(dialogState.row.id, values)
      : await createLoan(values);

    if (!result.error) {
      invalidate();
      toast.success(t(isEditing ? "toast.updated" : "toast.created"));
    }

    return result;
  }

  async function handleDeleteConfirm() {
    if (!deletingLoan) return;
    setIsDeleting(true);
    const result = await deleteLoan(deletingLoan.id);
    setIsDeleting(false);
    setDeletingLoan(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    invalidate();
    toast.success(t("toast.deleted"));
  }

  const hasLoans = loans.length > 0;

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <PageHeader
        title={t("title")}
        subtitle={t("description")}
        right={
          <Button onClick={() => setDialogState({ mode: "create" })}>
            <PlusIcon />
            {t("buttons.add")}
          </Button>
        }
      />

      <KpiGrid columns={3}>
        <KpiCard
          label={t("kpis.totalRemaining")}
          value={money(totalRemaining)}
          tone="negative"
        />
        <KpiCard
          label={t("kpis.overdue")}
          value={overdueCount}
          tone="warning"
          subtitle={t("kpis.overdueLegend")}
        />
        <KpiCard
          label={t("kpis.settled")}
          value={settledCount}
          subtitle={t("kpis.settledLegend")}
        />
      </KpiGrid>

      {!hasLoans ? (
        <Empty className="border-none py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HandCoinsIcon />
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
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SearchInput
              value={searchText}
              onChange={setSearchText}
              placeholder={t("search.placeholder")}
              clearLabel={t("search.clear")}
            />

            <Select
              value={personId ?? ALL_VALUE}
              onValueChange={(value) =>
                setPersonId(value === ALL_VALUE ? undefined : value)
              }
            >
              <SelectTrigger className="h-8 w-55">
                <SelectValue placeholder={t("filters.person")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t("filters.allPeople")}</SelectItem>
                {people.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredLoans.length === 0 ? (
            <div className="rounded-md border border-border">
              <Empty className="border-none py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HandCoinsIcon />
                  </EmptyMedia>
                  <EmptyTitle>{t("search.empty.title")}</EmptyTitle>
                  <EmptyDescription>
                    {t("search.empty.description")}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredLoans.map((loan) => {
                const progressLabel = t("card.progress", {
                  paid: loan.paidInstallmentCount,
                  total: loan.installmentCount,
                });

                return (
                  <Card key={loan.id} radius="lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3 text-base">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <HandCoinsIcon weight="fill" className="size-5 text-muted-foreground" />
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate">{loan.person.name}</span>
                          <span className="truncate text-xs font-normal text-muted-foreground">
                            {loan.description}
                          </span>
                        </span>
                      </CardTitle>
                      <CardAction>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <DotsThreeIcon />
                              <span className="sr-only">{t("aria.menu")}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => setDialogState({ mode: "edit", row: loan })}
                            >
                              {t("menu.edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setDeletingLoan(loan)}
                            >
                              {t("menu.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
                        <span className="text-xs text-muted-foreground">
                          {t("card.remaining")}
                        </span>
                        <span className="text-2xl font-bold tabular-nums text-negative">
                          {money(loan.remainingTotal)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {progressLabel}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <LoanStatusBadge
                          status={loan.status}
                          label={t(`status.${loanStatusMessageKey(loan.status)}`)}
                        />
                        {loan.nextDueDate ? (
                          <span className="text-xs text-muted-foreground">
                            {t("card.nextDueDate", {
                              date: format.dateTime(
                                loan.nextDueDate,
                                DATE_ONLY_FORMAT_OPTIONS,
                              ),
                            })}
                          </span>
                        ) : null}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button asChild variant="outline" size="sm" className="w-full">
                        <Link href={`/loans/${loan.id}`}>{t("card.viewDetails")}</Link>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <LoanSheet
        open={dialogState !== null}
        onOpenChange={(open) => {
          if (!open) setDialogState(null);
        }}
        mode={dialogState?.mode ?? "create"}
        prefill={dialogState?.mode === "edit" ? dialogState.row : null}
        people={people}
        accounts={accounts}
        onSubmit={handleSubmit}
      />

      <DeleteDialog
        open={deletingLoan !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingLoan(null);
        }}
        onConfirm={handleDeleteConfirm}
        isPending={isDeleting}
      />
    </div>
  );
}
