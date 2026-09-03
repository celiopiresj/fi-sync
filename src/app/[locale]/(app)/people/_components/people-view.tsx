"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
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
import { buildPersonStatementMessage } from "../_lib/statement-message";
import { buildWhatsAppLink } from "../_lib/whatsapp-message";
import { usePeopleData } from "../_hooks/use-people-data";
import { getPersonStatement } from "../actions";
import { balanceStatusOf, getPeopleColumns } from "./table/columns";
import { WhatsAppPreviewDialog } from "./whatsapp-preview-dialog";
import type { PersonRow } from "../_types/types";

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; row: PersonRow }
  | null;

type BalanceStatusFilter = "all" | "toReceive" | "toPay" | "settled";

type PeopleViewProps = {
  initialPeople: PersonRow[];
};

export function PeopleView({ initialPeople }: PeopleViewProps) {
  const t = useTranslations("scrn-people");
  const format = useFormatter();
  const router = useRouter();

  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [deletingPerson, setDeletingPerson] = useState<PersonRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<BalanceStatusFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [chargingPersonId, setChargingPersonId] = useState<string | null>(null);
  const [chargePreview, setChargePreview] = useState<{
    message: string;
    whatsappLink: string;
  } | null>(null);

  const { people, invalidatePeople } = usePeopleData(initialPeople);

  const money = (value: number) =>
    format.number(value, { style: "currency", currency: "BRL" });

  // Sign convention matches the person detail page's "Saldo na conta"/
  // "Total a pagar": positive balance = the user owes this person,
  // negative = this person owes the user (see listPeople in actions.ts).
  // Excludes the self ("Eu") person — a balance against yourself isn't a
  // real debt either direction, so it shouldn't inflate what's actually
  // owed across everyone else (see the card rendering below, which hides
  // the balance/"Cobrar" UI for the same person for the same reason).
  const { totalToReceive, totalToPay, pendingCount } = useMemo(() => {
    return people.reduce(
      (acc, person) => {
        if (person.isSelf) return acc;
        if (person.balance < 0) acc.totalToReceive += Math.abs(person.balance);
        if (person.balance > 0) acc.totalToPay += person.balance;
        if (person.balance !== 0) acc.pendingCount += 1;
        return acc;
      },
      { totalToReceive: 0, totalToPay: 0, pendingCount: 0 },
    );
  }, [people]);

  const filteredPeople = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const queryDigits = query.replace(/\D/g, "");
    return people.filter((person) => {
      const matchesName = person.name.toLowerCase().includes(query);
      const phoneDigits = `${person.phoneCountryCode ?? ""}${person.phone ?? ""}`;
      const matchesPhone = queryDigits.length > 0 && phoneDigits.includes(queryDigits);
      const matchesSearch = !query || matchesName || matchesPhone;
      if (!matchesSearch) return false;

      if (statusFilter === "toReceive") return person.balance < 0;
      if (statusFilter === "toPay") return person.balance > 0;
      if (statusFilter === "settled") return person.balance === 0;
      return true;
    });
  }, [people, searchText, statusFilter]);

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
      if (!statement) return;

      const message = buildPersonStatementMessage(statement, period, t, format);
      const whatsappLink = buildWhatsAppLink(
        statement.person.phoneCountryCode,
        statement.person.phone,
        message,
      );
      if (!whatsappLink) {
        toast.error(t("detail.whatsapp.noPhoneToast"));
        return;
      }
      setChargePreview({ message, whatsappLink });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, format, router],
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
        const balanceBadgeVariant =
          balanceStatus === "toReceive"
            ? "default"
            : balanceStatus === "toPay"
              ? "destructive"
              : "secondary";
        const balanceTextClass =
          balanceStatus === "toReceive"
            ? "text-positive"
            : balanceStatus === "toPay"
              ? "text-negative"
              : "text-foreground";
        const balanceSign =
          balanceStatus === "toReceive"
            ? "+ "
            : balanceStatus === "toPay"
              ? "- "
              : "";
        const isCharging = chargingPersonId === person.id;

        return (
          <Card key={person.id} radius="lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-base">
                <Avatar>
                  <AvatarFallback className={color}>
                    {getPersonInitial(person.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    {person.name}
                    {person.isSelf && (
                      <Badge variant="secondary">{t("card.selfBadge")}</Badge>
                    )}
                  </span>
                  {phone ? (
                    <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                      <PhoneIcon className="size-3" />
                      {phone}
                    </span>
                  ) : null}
                </div>
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
                    <Badge variant={balanceBadgeVariant} className="uppercase">
                      {t(`card.balanceStatus.${balanceStatus}`)}
                    </Badge>
                  </div>
                </div>
              )}

              <p className="flex items-center gap-1 px-0.5 text-xs text-muted-foreground">
                <ReceiptIcon className="size-3.5" />
                {t("card.splitsCount", { count: person.splitsCount })}
              </p>
            </CardContent>
            <CardFooter
              className={cn(
                "grid gap-2",
                person.isSelf ? "grid-cols-1" : "grid-cols-2",
              )}
            >
              <Button asChild variant="outline" size="sm">
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
                  onClick={() => handleCharge(person)}
                  disabled={!phone || isCharging}
                  title={phone ? undefined : t("detail.header.noPhone")}
                >
                  {isCharging ? (
                    <SpinnerIcon className="size-4 animate-spin" />
                  ) : (
                    <ChatCircleIcon className="size-4" />
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

            <div className="flex flex-wrap items-center gap-3">
              <ToggleGroup
                type="single"
                variant="tabs"
                size="sm"
                value={statusFilter}
                onValueChange={(value) => {
                  if (value) setStatusFilter(value as BalanceStatusFilter);
                }}
              >
                <ToggleGroupItem value="all">
                  {t("filters.status.all")} ({people.length})
                </ToggleGroupItem>
                <ToggleGroupItem value="toReceive">
                  {t("filters.status.toReceive")}
                </ToggleGroupItem>
                <ToggleGroupItem value="toPay">
                  {t("filters.status.toPay")}
                </ToggleGroupItem>
                <ToggleGroupItem value="settled">
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
                <Button size="sm" variant="outline" onClick={() => setSearchText("")}>
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
        linkedSplitsCount={deletingPerson?.splitsCount ?? 0}
      />

      {chargePreview ? (
        <WhatsAppPreviewDialog
          open={chargePreview !== null}
          onOpenChange={(open) => {
            if (!open) setChargePreview(null);
          }}
          message={chargePreview.message}
          whatsappLink={chargePreview.whatsappLink}
        />
      ) : null}
    </div>
  );
}
