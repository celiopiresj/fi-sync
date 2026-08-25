"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CreditCardSheet } from "./form/credit-card-sheet";
import { DeleteDialog } from "./delete-dialog";
import { CardsHeader } from "./cards-header";
import { CardsSummary } from "./cards-summary";
import { AttentionSection } from "./attention-section";
import { UpcomingDueSection } from "./upcoming-due-section";
import { AllCardsSection } from "./all-cards-section";
import type { CreditCardAccountFormValues } from "../_schema/schema";
import {
  createCreditCardAccount,
  deleteCreditCardAccount,
  toggleCreditCardAccountStatus,
  updateCreditCardAccount,
} from "../actions";
import { useCardsData } from "../_hooks/use-cards-data";
import {
  buildSummary,
  getAttentionCards,
  getOtherCards,
  getUpcomingDueGroups,
} from "../_lib/card-sections";
import type { CreditCardAccountRow } from "../_types/types";

// "edit" only stores the id, not a snapshot of the row — CreditCardForm
// lets the user toggle a card's enabled state (toggleCardStatus) while
// the sheet is still open, so `editingAccount` below is re-derived from
// the live `accounts` list on every render instead of going stale the
// moment that happens.
type DialogState = { mode: "create" } | { mode: "edit"; id: string } | null;

type CardsViewProps = {
  initialAccounts: CreditCardAccountRow[];
};

export function CardsView({ initialAccounts }: CardsViewProps) {
  const t = useTranslations("scrn-cards");

  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [deletingAccount, setDeletingAccount] =
    useState<CreditCardAccountRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { accounts, invalidateCards } = useCardsData(initialAccounts);

  const editingAccount =
    dialogState?.mode === "edit"
      ? (accounts.find((account) => account.id === dialogState.id) ?? null)
      : null;

  async function handleSubmit(values: CreditCardAccountFormValues) {
    const isEditing = dialogState?.mode === "edit";
    const result = isEditing
      ? await updateCreditCardAccount(dialogState.id, values)
      : await createCreditCardAccount(values);

    if (!result.error) {
      invalidateCards();
      toast.success(t(isEditing ? "toast.updated" : "toast.created"));
    }

    return result;
  }

  async function handleToggleStatus(account: CreditCardAccountRow) {
    const wasActive = account.status === "ACTIVE";
    const result = await toggleCreditCardAccountStatus(account.id);
    if (!result.error) {
      invalidateCards();
      toast.success(t(wasActive ? "toast.archived" : "toast.reactivated"));
    } else {
      toast.error(result.error);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingAccount) return;
    setIsDeleting(true);
    const result = await deleteCreditCardAccount(deletingAccount.id);
    setIsDeleting(false);
    setDeletingAccount(null);
    if (!result.error) {
      invalidateCards();
      toast.success(t("toast.deleted"));
    } else {
      toast.error(result.error);
    }
  }

  const hasAccounts = accounts.length > 0;
  const summary = buildSummary(accounts);
  const attentionCards = getAttentionCards(accounts);
  const otherCards = getOtherCards(accounts);
  const upcomingGroups = getUpcomingDueGroups(accounts);

  function openEdit(id: string) {
    setDialogState({ mode: "edit", id });
  }

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <CardsHeader
        summary={summary}
        onCreate={() => setDialogState({ mode: "create" })}
      />

      {!hasAccounts ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-12">
          <p className="text-sm font-medium">{t("empty.title")}</p>
          <p className="text-xs text-muted-foreground">{t("empty.description")}</p>
          <Button size="sm" onClick={() => setDialogState({ mode: "create" })}>
            {t("empty.button")}
          </Button>
        </div>
      ) : (
        <>
          <CardsSummary summary={summary} />

          <AttentionSection
            accounts={attentionCards}
            onEdit={openEdit}
            onToggleStatus={handleToggleStatus}
            onDelete={setDeletingAccount}
          />

          <UpcomingDueSection groups={upcomingGroups} />

          <AllCardsSection
            accounts={otherCards}
            onEdit={openEdit}
            onToggleStatus={handleToggleStatus}
            onDelete={setDeletingAccount}
          />
        </>
      )}

      <CreditCardSheet
        open={dialogState !== null}
        onOpenChange={(open) => {
          if (!open) setDialogState(null);
        }}
        mode={dialogState?.mode ?? "create"}
        prefill={editingAccount}
        onSubmit={handleSubmit}
        onCardStatusChanged={invalidateCards}
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
