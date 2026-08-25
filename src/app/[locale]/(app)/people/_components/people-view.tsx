"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ChatCircleIcon,
  DotsThreeIcon,
  ListIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  ReceiptIcon,
  SpinnerIcon,
  SquaresFourIcon,
  TrendDownIcon,
  TrendUpIcon,
  UsersIcon,
  XIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Link, useRouter } from "@/i18n/navigation";
import { DataTable } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
type ViewMode = "grid" | "table";

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
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
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
  const { totalToReceive, totalToPay, pendingCount } = useMemo(() => {
    return people.reduce(
      (acc, person) => {
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
          menu: { edit: t("menu.edit"), delete: t("menu.delete"), openMenu: t("table.menu.openMenu") },
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

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button onClick={() => setDialogState({ mode: "create" })}>
          {t("buttons.add")}
        </Button>
      </div>

      {!hasPeople ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-12">
          <p className="text-sm font-medium">{t("empty.title")}</p>
          <p className="text-xs text-muted-foreground">
            {t("empty.description")}
          </p>
          <Button size="sm" onClick={() => setDialogState({ mode: "create" })}>
            {t("empty.button")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <TrendUpIcon className="size-5" />
                </span>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">
                    {t("kpis.toReceive")}
                  </span>
                  <span className="text-lg font-semibold tabular-nums">
                    {money(totalToReceive)}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                  <TrendDownIcon className="size-5" />
                </span>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">
                    {t("kpis.toPay")}
                  </span>
                  <span className="text-lg font-semibold tabular-nums">
                    {money(totalToPay)}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <UsersIcon className="size-5" />
                </span>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">
                    {t("kpis.registered")}
                  </span>
                  <span className="text-lg font-semibold tabular-nums">
                    {people.length}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({t("kpis.pending", { count: pendingCount })})
                    </span>
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-md">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={t("search.placeholder")}
                className="h-9 pl-9 pr-8"
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => setSearchText("")}
                  aria-label={t("search.clear")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-4" />
                </button>
              )}
            </div>

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

              <ToggleGroup
                type="single"
                variant="tabs"
                size="sm"
                value={viewMode}
                onValueChange={(value) => {
                  if (value) setViewMode(value as ViewMode);
                }}
              >
                <ToggleGroupItem value="grid" aria-label={t("viewMode.grid")}>
                  <SquaresFourIcon />
                </ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label={t("viewMode.table")}>
                  <ListIcon />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {filteredPeople.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-12">
              <p className="text-sm font-medium">{t("empty.noResults.title")}</p>
              <p className="text-xs text-muted-foreground">
                {t("empty.noResults.description")}
              </p>
              <Button size="sm" variant="outline" onClick={() => setSearchText("")}>
                {t("empty.noResults.button")}
              </Button>
            </div>
          ) : viewMode === "table" ? (
            <DataTable
              columns={columns}
              data={filteredPeople}
              getRowId={(row) => row.id}
              emptyState={null}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPeople.map((person) => {
                const phone = joinPersonPhone(
                  person.phoneCountryCode,
                  person.phone,
                );
                const color = getPersonColorClasses(person.name);
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
                  <Card key={person.id} className="rounded-2xl">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3 text-base">
                        <Avatar>
                          <AvatarFallback className={cn(color.bg, color.text)}>
                            {getPersonInitial(person.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col gap-0.5">
                          <span>{person.name}</span>
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
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setDeletingPerson(person)}
                            >
                              {t("menu.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
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

                      <p className="flex items-center gap-1 px-0.5 text-xs text-muted-foreground">
                        <ReceiptIcon className="size-3.5" />
                        {t("card.splitsCount", { count: person.splitsCount })}
                      </p>
                    </CardContent>
                    <CardFooter className="grid grid-cols-2 gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/people/${person.id}`}>
                          {t("buttons.viewStatement")}
                        </Link>
                      </Button>
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
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
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
