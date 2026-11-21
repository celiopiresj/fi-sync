"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BankIcon, PlusIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageHeader } from "@/components/screen/page-header";
import { AccountsSummary } from "./accounts-summary";
import { AccountGroupSection } from "./account-group-section";
import { AccountSheet } from "./form/account-sheet";
import { DeleteDialog } from "./delete-dialog";
import type { AccountFormValues, AccountTypeOption } from "../_schema/schema";
import {
  createAccount,
  deleteAccount,
  toggleAccountStatus,
  toggleDefaultAccount,
  updateAccount,
} from "../actions";
import { useAccountsData } from "../_hooks/use-accounts-data";
import { groupAccountsByType, summarizeAccounts } from "../_lib/account-groups";
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

  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [deletingAccount, setDeletingAccount] = useState<AccountRow | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const { accounts, invalidateAccounts } = useAccountsData(initialAccounts);

  const groups = useMemo(() => groupAccountsByType(accounts), [accounts]);
  const summary = useMemo(() => summarizeAccounts(accounts), [accounts]);

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
    if (result.error) {
      toast.error(t("toast.error"));
      return;
    }
    invalidateAccounts();
    toast.success(t(wasActive ? "toast.archived" : "toast.reactivated"));
  }

  async function handleToggleDefault(account: AccountRow) {
    const wasDefault = account.isDefault;
    const result = await toggleDefaultAccount(account.id);
    if (result.error) {
      toast.error(t("toast.error"));
      return;
    }
    invalidateAccounts();
    toast.success(t(wasDefault ? "toast.defaultUnset" : "toast.defaultSet"));
  }

  async function handleDeleteConfirm() {
    if (!deletingAccount) return;
    setIsDeleting(true);
    try {
      const result = await deleteAccount(deletingAccount.id);
      if (result?.error) {
        toast.error(t("toast.error"));
        return;
      }
      setDeletingAccount(null);
      invalidateAccounts();
      toast.success(t("toast.deleted"));
    } catch {
      toast.error(t("toast.error"));
    } finally {
      setIsDeleting(false);
    }
  }

  const hasAccounts = accounts.length > 0;

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <PageHeader
        title={t("title")}
        subtitle={t("description")}
        right={
          <Button
            className="h-11 sm:h-9"
            onClick={() => setDialogState({ mode: "create" })}
          >
            <PlusIcon aria-hidden="true" />
            {t("buttons.add")}
          </Button>
        }
      />

      {!hasAccounts ? (
        <Empty className="border-none py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BankIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("empty.title")}</EmptyTitle>
            <EmptyDescription>{t("empty.description")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              className="h-11 sm:h-9"
              onClick={() => setDialogState({ mode: "create" })}
            >
              <PlusIcon aria-hidden="true" />
              {t("empty.button")}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <AccountsSummary summary={summary} groups={groups} />

          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <AccountGroupSection
                key={group.type}
                group={group}
                onAdd={(type) => setDialogState({ mode: "create", type })}
                onEdit={(row) => setDialogState({ mode: "edit", row })}
                onToggleDefault={handleToggleDefault}
                onToggleStatus={handleToggleStatus}
                onDelete={setDeletingAccount}
              />
            ))}
          </div>
        </>
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
        accountName={deletingAccount?.name ?? ""}
      />
    </div>
  );
}
