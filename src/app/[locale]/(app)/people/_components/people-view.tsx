"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ChatCircleIcon,
  DotsThreeIcon,
  PhoneIcon,
  ReceiptIcon,
  SpinnerIcon,
  TrendDownIcon,
  TrendUpIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Link, useRouter } from "@/i18n/navigation";
import { DataTable } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader } from "@/components/screen/page-header";
import { KpiCard, KpiGrid } from "@/components/screen/kpi-card";
import { SearchInput } from "@/components/screen/search-input";
import { ViewModeToggle, type ViewMode } from "@/components/screen/view-mode-toggle";
import { PersonSheet } from "./form/person-sheet";
import { DeleteDialog } from "./delete-dialog";
import type { PersonFormValues } from "../_schema/schema";
import { createPerson, deletePerson, updatePerson } from "../actions";
import { joinPersonPhone } from "../_lib/phone";
import { getPersonColorClasses, getPersonInitial } from "../_lib/person-avatar";
import { currentStatementPeriod } from "../_lib/cash-cycle";
import { usePeopleData } from "../_hooks/use-people-data";
import { getPersonStatement } from "../actions";
import { getPeopleColumns } from "./table/columns";
import { usePersonMoney } from "../_hooks/use-person-money";
import {
  balanceStatusOf,
  filterPeople,
  summarizePeople,
} from "../_lib/people-list";
import {
  BALANCE_STATUS_BADGE,
  BALANCE_STATUS_TEXT,
} from "../_constants/constants";
import { WhatsAppPreviewDialog } from "./whatsapp-preview-dialog";
import type {
  BalanceStatusFilter,
  PersonRow,
  PersonStatement,
  StatementPeriod,
} from "../_types/types";

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; row: PersonRow }
  | null;

type PeopleViewProps = {
  initialPeople: PersonRow[];
};

export function PeopleView({ initialPeople }: PeopleViewProps) {
  const t = useTranslations("scrn-people");
  const router = useRouter();
  const money = usePersonMoney();

  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [deletingPerson, setDeletingPerson] = useState<PersonRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<BalanceStatusFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [chargingPersonId, setChargingPersonId] = useState<string | null>(null);
  const [chargePreview, setChargePreview] = useState<{
    statement: NonNullable<PersonStatement>;
    period: StatementPeriod;
  } | null>(null);

  const { people, invalidatePeople } = usePeopleData(initialPeople);

  const { totalToReceive, totalToPay, pendingCount } = useMemo(
    () => summarizePeople(people),
    [people],
  );

  const filteredPeople = useMemo(
    () => filterPeople(people, searchText, statusFilter),
    [people, searchText, statusFilter],
  );

  async function handleSubmit(values: PersonFormValues) {
    const isEditing = dialogState?.mode === "edit";
    const result = isEditing
      ? await updatePerson(dialogState.row.id, values)
      : await createPerson(values);

    if (!result.error) {
      invalidatePeople();
      toast.success(t(isEditing ? "toast.updated" : "toast.created"));
    }

    return result;
  }

  async function handleDeleteConfirm() {
    if (!deletingPerson) return;
    setIsDeleting(true);
    const result = await deletePerson(deletingPerson.id);
    setIsDeleting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      invalidatePeople();
      toast.success(t("toast.deleted"));
    }
    setDeletingPerson(null);
  }

  // Reuses the exact same message-building code as the person detail
  // page's "Enviar via WhatsApp" (see people/_lib/statement-message.ts) —
  // fetches that person's current-period statement on demand (the list
  // doesn't hold movements/card sections, only the all-time balance) and
  // opens the same preview dialog.
  async function handleCharge(person: PersonRow) {
    if (!person.phone) {
      toast.error(t("detail.whatsapp.noPhoneToast"));
      return;
    }
    setChargingPersonId(person.id);
    try {
      const period = currentStatementPeriod();
      const statement = await getPersonStatement(person.id, period);
      if (!statement) {
        toast.error(t("toast.error"));
        return;
      }

      setChargePreview({ statement, period });
    } catch {
      toast.error(t("toast.error"));
    } finally {
      setChargingPersonId(null);
    }
  }

  const columns = useMemo(
    () =>
      getPeopleColumns(
        {
          columns: {
            person: t("table.columns.person"),
            phone: t("table.columns.phone"),
            splitsCount: t("table.columns.splitsCount"),
            balance: t("table.columns.balance"),
          },
          splitsCount: (count) => t("card.splitsCount", { count }),
          balanceStatus: (status) => t(`card.balanceStatus.${status}`),
          viewStatement: t("buttons.viewStatement"),
          selfBadge: t("card.selfBadge"),
          menu: {
            edit: t("menu.edit"),
            delete: t("menu.delete"),
            openMenu: t("table.menu.openMenu"),
          },
        },
        money,
        {
          onViewStatement: (row) => router.push(`/people/${row.id}`),
          onEdit: (row) => setDialogState({ mode: "edit", row }),
          onDelete: (row) => setDeletingPerson(row),
        },
      ),
    [t, money, router],
  );

  const hasPeople = people.length > 0;

  // Shared between "cards" mode (always) and "list" mode's own
  // narrow-screen fallback below `min-[700px]` — DataTable doesn't reflow
  // well on a phone (same limitation as transactions'/recurrences' own
  // DataTable, see transaction-mobile-list.tsx's comment), and this grid
  // already contains every field the table's columns show, so it doubles
  // as that fallback instead of a dedicated people-mobile-list.tsx twin.
  const peopleCardsGrid = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {filteredPeople.map((person) => {
        const phone = joinPersonPhone(
          person.phoneCountryCode,
          person.phone,
        );
        const color = getPersonColorClasses(person.name, person.colorStyle);
        const balanceStatus = balanceStatusOf(person.balance);
        const balanceTextClass = BALANCE_STATUS_TEXT[balanceStatus];
        const balanceSign =
          balanceStatus === "toReceive"
            ? "+ "
            : balanceStatus === "toPay"
              ? "- "
              : "";
        const isCharging = chargingPersonId === person.id;

        return (
          <Card key={person.id} className="@container">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-base">
                <Avatar>
                  <AvatarFallback className={color}>
                    {getPersonInitial(person.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-1.5 break-words">
                    {person.name}
                    {person.isSelf && (
                      <Badge variant="secondary">{t("card.selfBadge")}</Badge>
                    )}
                  </span>
                  {phone ? (
                    <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                      <PhoneIcon aria-hidden="true" className="size-3 shrink-0" />
                      {phone}
                    </span>
                  ) : null}
                </div>
              </CardTitle>
              <CardAction>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="size-11 md:size-8">
                      <DotsThreeIcon aria-hidden="true" />
                      <span className="sr-only">{t("aria.menu")}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() =>
                        setDialogState({ mode: "edit", row: person })
                      }
                    >
                      {t("menu.edit")}
                    </DropdownMenuItem>
                    {!person.isSelf && (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeletingPerson(person)}
                      >
                        {t("menu.delete")}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardAction>
            </CardHeader>
            {/* flex-1: grows to fill whatever height the grid
                stretched this card to (equal-height siblings),
                so the footer sits right after the real content
                instead of floating with dead space below it —
                matters most for the self ("Eu") card, which has
                no balance block to fill that space with. */}
            <CardContent className="flex flex-1 flex-col gap-3">
              {/* A balance against yourself isn't a real debt —
                  "Saldo Atual"/"Você recebe"/"Você deve" only
                  make sense between the user and someone else,
                  same reasoning the KPI totals above exclude
                  self for. */}
              {!person.isSelf && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 p-3">
                  <span className="text-xs text-muted-foreground">
                    {t("card.balanceLabel")}
                  </span>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={cn(
                        "text-base font-bold tabular-nums",
                        balanceTextClass,
                      )}
                    >
                      {balanceSign}
                      {money(Math.abs(person.balance))}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("uppercase", BALANCE_STATUS_BADGE[balanceStatus])}
                    >
                      {t(`card.balanceStatus.${balanceStatus}`)}
                    </Badge>
                  </div>
                </div>
              )}

              <p className="flex items-center gap-1 px-0.5 text-xs text-muted-foreground">
                <ReceiptIcon aria-hidden="true" className="size-3.5" />
                {t("card.splitsCount", { count: person.splitsCount })}
              </p>
            </CardContent>
            <CardFooter
              className={cn(
                "grid gap-2",
                person.isSelf ? "grid-cols-1" : "grid-cols-2",
              )}
            >
              <Button asChild variant="outline" size="sm" className="h-11 sm:h-8">
                <Link href={`/people/${person.id}`}>
                  {t("buttons.viewStatement")}
                </Link>
              </Button>
              {/* "Cobrar" only makes sense against someone else —
                  same reasoning as the balance block above. */}
              {!person.isSelf && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-11 sm:h-8"
                  onClick={() => handleCharge(person)}
                  disabled={!phone || isCharging}
                  title={phone ? undefined : t("detail.header.noPhone")}
                >
                  {isCharging ? (
                    <SpinnerIcon aria-hidden="true" className="size-4 animate-spin" />
                  ) : (
                    <ChatCircleIcon aria-hidden="true" className="size-4" />
                  )}
                  {t("buttons.charge")}
                </Button>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );

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

      {!hasPeople ? (
        <Empty className="border-none py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
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
        <div className="flex flex-col gap-4">
          <KpiGrid columns={3}>
            <KpiCard
              label={t("kpis.toReceive")}
              value={money(totalToReceive)}
              tone="positive"
              icon={<TrendUpIcon className="size-5" />}
            />
            <KpiCard
              label={t("kpis.toPay")}
              value={money(totalToPay)}
              tone="negative"
              icon={<TrendDownIcon className="size-5" />}
            />
            <KpiCard
              label={t("kpis.registered")}
              value={
                <>
                  {people.length}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({t("kpis.pending", { count: pendingCount })})
                  </span>
                </>
              }
              icon={<UsersIcon className="size-5" />}
            />
          </KpiGrid>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <SearchInput
              value={searchText}
              onChange={setSearchText}
              placeholder={t("search.placeholder")}
              clearLabel={t("search.clear")}
            />

            <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as BalanceStatusFilter)
                }
              >
                <SelectTrigger
                  aria-label={t("filters.status.all")}
                  className="h-11 w-full sm:hidden"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("filters.status.all")} ({people.length})
                  </SelectItem>
                  <SelectItem value="toReceive">
                    {t("filters.status.toReceive")}
                  </SelectItem>
                  <SelectItem value="toPay">
                    {t("filters.status.toPay")}
                  </SelectItem>
                  <SelectItem value="settled">
                    {t("filters.status.settled")}
                  </SelectItem>
                </SelectContent>
              </Select>

              <ToggleGroup
                type="single"
                variant="tabs"
                size="sm"
                value={statusFilter}
                onValueChange={(value) => {
                  if (value) setStatusFilter(value as BalanceStatusFilter);
                }}
                className="hidden sm:flex"
              >
                <ToggleGroupItem value="all" className="h-7">
                  {t("filters.status.all")} ({people.length})
                </ToggleGroupItem>
                <ToggleGroupItem value="toReceive" className="h-7">
                  {t("filters.status.toReceive")}
                </ToggleGroupItem>
                <ToggleGroupItem value="toPay" className="h-7">
                  {t("filters.status.toPay")}
                </ToggleGroupItem>
                <ToggleGroupItem value="settled" className="h-7">
                  {t("filters.status.settled")}
                </ToggleGroupItem>
              </ToggleGroup>

              <ViewModeToggle
                value={viewMode}
                onValueChange={setViewMode}
                cardsLabel={t("viewMode.grid")}
                listLabel={t("viewMode.table")}
              />
            </div>
          </div>

          {filteredPeople.length === 0 ? (
            <Empty className="border-none py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersIcon />
                </EmptyMedia>
                <EmptyTitle>{t("empty.noResults.title")}</EmptyTitle>
                <EmptyDescription>
                  {t("empty.noResults.description")}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 sm:h-8"
                  onClick={() => {
                    setSearchText("");
                    setStatusFilter("all");
                  }}
                >
                  {t("empty.noResults.button")}
                </Button>
              </EmptyContent>
            </Empty>
          ) : viewMode === "list" ? (
            <>
              {/* DataTable doesn't reflow well below `min-[700px]` (same
                  limitation as transactions'/recurrences' own DataTable) —
                  the cards grid already covers every field the table's
                  columns show, so it's reused as the narrow-screen
                  fallback instead of a dedicated mobile-list component. */}
              <div className="hidden min-[700px]:block">
                <DataTable
                  columns={columns}
                  data={filteredPeople}
                  getRowId={(row) => row.id}
                  emptyState={null}
                />
              </div>
              <div className="block min-[700px]:hidden">{peopleCardsGrid}</div>
            </>
          ) : (
            peopleCardsGrid
          )}
        </div>
      )}

      <PersonSheet
        open={dialogState !== null}
        onOpenChange={(open) => {
          if (!open) setDialogState(null);
        }}
        mode={dialogState?.mode ?? "create"}
        prefill={dialogState?.mode === "edit" ? dialogState.row : null}
        onSubmit={handleSubmit}
      />

      <DeleteDialog
        open={deletingPerson !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingPerson(null);
        }}
        onConfirm={handleDeleteConfirm}
        isPending={isDeleting}
        personName={deletingPerson?.name ?? ""}
        linkedSplitsCount={deletingPerson?.splitsCount ?? 0}
      />

      {chargePreview ? (
        <WhatsAppPreviewDialog
          open={chargePreview !== null}
          onOpenChange={(open) => {
            if (!open) setChargePreview(null);
          }}
          statement={chargePreview.statement}
          period={chargePreview.period}
          phoneCountryCode={chargePreview.statement.person.phoneCountryCode}
          phone={chargePreview.statement.person.phone}
        />
      ) : null}
    </div>
  );
}
