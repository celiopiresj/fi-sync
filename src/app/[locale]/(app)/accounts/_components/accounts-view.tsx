"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { BankIcon, DotsThreeIcon, PlusIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
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
import { AccountSheet } from "./form/account-sheet";
import { DeleteDialog } from "./delete-dialog";
import {
  accountTypeValues,
  type AccountFormValues,
  type AccountTypeOption,
} from "../_schema/schema";
import {
  createAccount,
  deleteAccount,
  toggleAccountStatus,
  toggleDefaultAccount,
  updateAccount,
} from "../actions";
import { useAccountsData } from "../_hooks/use-accounts-data";
import { getAccountColorClasses } from "../_lib/account-color";
import type { AccountRow } from "../_types/types";

type DialogState =
  | { mode: "create"; type?: AccountTypeOption }
  | { mode: "edit"; row: AccountRow }
  | null;

type AccountsViewProps = {
  initialAccounts: AccountRow[];
};

export function AccountsView({ initialAccounts }: AccountsViewProps) {
  const t = useTranslations("scrn-accounts");
  const tCommon = useTranslations("common");
  const format = useFormatter();

  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [deletingAccount, setDeletingAccount] = useState<AccountRow | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const { accounts, invalidateAccounts } = useAccountsData(initialAccounts);

  // Fixed CHECKING -> SAVINGS -> CASH section order regardless of data;
  // within a section, active accounts first, then inactive (archived
  // ones sink to the bottom instead of interleaving).
  const groups = useMemo(
    () =>
      accountTypeValues.map((type) => ({
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

  async function handleSubmit(values: AccountFormValues) {
    const isEditing = dialogState?.mode === "edit";
    const result = isEditing
      ? await updateAccount(dialogState.row.id, values)
      : await createAccount(values);

    if (!result.error) {
      invalidateAccounts();
      toast.success(t(isEditing ? "toast.updated" : "toast.created"));
    }

    return result;
  }

  async function handleToggleStatus(account: AccountRow) {
    const wasActive = account.status === "ACTIVE";
    const result = await toggleAccountStatus(account.id);
    if (!result.error) {
      invalidateAccounts();
      toast.success(t(wasActive ? "toast.archived" : "toast.reactivated"));
    }
  }

  async function handleToggleDefault(account: AccountRow) {
    const wasDefault = account.isDefault;
    const result = await toggleDefaultAccount(account.id);
    if (!result.error) {
      invalidateAccounts();
      toast.success(t(wasDefault ? "toast.defaultUnset" : "toast.defaultSet"));
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingAccount) return;
    setIsDeleting(true);
    await deleteAccount(deletingAccount.id);
    setIsDeleting(false);
    setDeletingAccount(null);
    invalidateAccounts();
    toast.success(t("toast.deleted"));
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

      {!hasAccounts ? (
        <Empty className="border-none py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BankIcon />
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
          {groups.map((group) => (
            <div key={group.type} className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                {t(`fields.type.${group.type.toLowerCase()}`)}
              </h2>
              {group.accounts.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.accounts.map((account) => {
                    const color = getAccountColorClasses(account.id);
                    const balance = format.number(account.balance, {
                      style: "currency",
                      currency: "BRL",
                    });

                    return (
                      <Card
                        key={account.id}
                        className={cn(
                          // `relative` is what anchors the stretched
                          // link on the account name below (its
                          // `after:absolute after:inset-0` covers the
                          // whole card, so clicking anywhere on it opens
                          // the detail screen) — the actions menu opts
                          // back out with its own `relative z-10`.
                          "relative sm:max-w-85",
                          account.status === "INACTIVE" && "opacity-60",
                        )}
                      >
                        <CardHeader>
                          <CardTitle className="flex items-center gap-3 text-base">
                            <span
                              className={cn(
                                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                                color.bg,
                              )}
                            >
                              <BankIcon
                                weight="fill"
                                className={cn("size-5", color.icon)}
                              />
                            </span>
                            <Link
                              href={`/accounts/${account.id}`}
                              className="after:absolute after:inset-0 hover:underline"
                            >
                              {account.name}
                            </Link>
                          </CardTitle>
                          <CardAction className="relative z-10">
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
                                  onSelect={() => handleToggleDefault(account)}
                                >
                                  {t(
                                    account.isDefault
                                      ? "menu.unsetDefault"
                                      : "menu.setDefault",
                                  )}
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
                          {account.initialBalance !== null && (
                            <span className="text-xs text-muted-foreground">
                              {t("fields.initialBalance.cardLabel")}:{" "}
                              {format.number(account.initialBalance, {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </span>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant={
                                account.status === "ACTIVE"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {tCommon(`status.${account.status.toLowerCase()}`)}
                            </Badge>
                            {account.isDefault && (
                              <Badge variant="outline">{t("card.defaultBadge")}</Badge>
                            )}
                          </div>
                        </CardContent>
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
          ))}
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
