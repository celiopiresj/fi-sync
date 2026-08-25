"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useStore } from "@tanstack/react-form";
import { toast } from "sonner";
import { useZodForm } from "@/lib/form/use-zod-form";
import { FormError } from "@/components/form/form-error";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PlusIcon, SpinnerIcon, TrashIcon } from "@phosphor-icons/react";
import { isNextRedirectError } from "@/lib/next/is-redirect-error";
import {
  creditCardAccountSchema,
  refineCreditCardAccount,
  emptyCreditCardAccountFormValues,
  emptyCardRow,
  type CreditCardAccountFormValues,
} from "../../_schema/schema";
import { toggleCardStatus, toggleCreditCardAccountStatus } from "../../actions";
import type { CreditCardAccountRow } from "../../_types/types";
import { ColorPicker } from "@/components/form/color-picker";

function toFormValues(
  row: CreditCardAccountRow | null,
): CreditCardAccountFormValues {
  if (!row) return emptyCreditCardAccountFormValues;

  return {
    name: row.name,
    limit: row.limit.toString().replace(".", ","),
    closingDay: row.closingDay !== null ? String(row.closingDay) : "",
    dueDay: row.dueDay !== null ? String(row.dueDay) : "",
    cards: row.cards.map((card) => ({
      id: card.id,
      name: card.name,
      lastFourDigits: card.lastFourDigits ?? "",
      colorStyle: card.colorStyle ?? undefined,
    })),
  };
}

type CreditCardFormProps = {
  isEditing: boolean;
  initialValues: CreditCardAccountRow | null;
  onSubmit: (
    values: CreditCardAccountFormValues,
  ) => Promise<{ error: string | null }>;
  onSuccess: () => void;
  // Card enable/disable (toggleCardStatus) is a separate, immediate
  // Server Action call — not part of this form's own submit — since it
  // has to work even while the rest of the form is mid-edit with unsaved
  // changes elsewhere. This tells the parent (credit-card-sheet.tsx) to
  // invalidate the cached account list afterward.
  onCardStatusChanged: () => void;
};

export function CreditCardForm({
  isEditing,
  initialValues,
  onSubmit,
  onSuccess,
  onCardStatusChanged,
}: CreditCardFormProps) {
  const t = useTranslations("scrn-cards");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("common.validation");
  const [serverError, setServerError] = useState<string | null>(null);
  const [togglingCardId, setTogglingCardId] = useState<string | null>(null);
  const [isTogglingAccountStatus, setIsTogglingAccountStatus] = useState(false);

  const schema = useMemo(
    () =>
      creditCardAccountSchema.superRefine((value, ctx) =>
        refineCreditCardAccount(value, ctx, {
          lastFourDigitsInvalid: tValidation("invalid"),
        }),
      ),
    [tValidation],
  );

  const form = useZodForm(schema, {
    defaultValues: toFormValues(initialValues),
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        const result = await onSubmit(value);
        if (result?.error) {
          setServerError(result.error);
          return;
        }
        onSuccess();
      } catch (err) {
        if (isNextRedirectError(err)) throw err;
        setServerError(tCommon("errorGeneric"));
      }
    },
  });

  const cards = useStore(form.store, (state) => state.values.cards);
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  async function handleToggleCard(cardId: string) {
    setTogglingCardId(cardId);
    const result = await toggleCardStatus(cardId);
    setTogglingCardId(null);
    if (!result.error) {
      onCardStatusChanged();
    } else {
      toast.error(result.error);
    }
  }

  // Same "separate, immediate Server Action call, not part of this
  // form's own submit" shape as handleToggleCard above, just for the
  // account itself instead of one physical card — lets the account be
  // archived/reactivated from inside the edit sheet, in addition to the
  // list's own row-level "⋮" menu (cards-view.tsx).
  async function handleToggleAccountStatus() {
    if (!initialValues) return;
    setIsTogglingAccountStatus(true);
    const result = await toggleCreditCardAccountStatus(initialValues.id);
    setIsTogglingAccountStatus(false);
    if (!result.error) {
      onCardStatusChanged();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <form.AppField name="name">
        {(field) => (
          <field.TextField
            label={t("fields.name.label")}
            placeholder={t("fields.name.placeholder")}
          />
        )}
      </form.AppField>

      <form.AppField name="limit">
        {(field) => (
          <field.AmountField
            label={t("fields.limit.label")}
            placeholder={t("fields.limit.placeholder")}
            size="lg"
          />
        )}
      </form.AppField>

      <form.AppField name="closingDay">
        {(field) => (
          <field.TextField
            label={t("fields.closingDay.label")}
            placeholder={t("fields.closingDay.placeholder")}
          />
        )}
      </form.AppField>

      <form.AppField name="dueDay">
        {(field) => (
          <field.TextField
            label={t("fields.dueDay.label")}
            placeholder={t("fields.dueDay.placeholder")}
          />
        )}
      </form.AppField>

      {isEditing && initialValues && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
          <div>
            <p className="text-sm font-medium">
              {t(
                initialValues.status === "ACTIVE"
                  ? "fields.status.activeLabel"
                  : "fields.status.inactiveLabel",
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {t(
                initialValues.status === "ACTIVE"
                  ? "fields.status.activeHelp"
                  : "fields.status.inactiveHelp",
              )}
            </p>
          </div>
          <Switch
            checked={initialValues.status === "ACTIVE"}
            disabled={isTogglingAccountStatus}
            onCheckedChange={handleToggleAccountStatus}
          />
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-md border border-border p-3">
        <p className="text-sm font-medium">{t("cards.title")}</p>

        <div className="flex flex-col gap-2">
          {cards.map((cardValue, index) => {
            // Enable/disable and "can this be removed" both depend on
            // whether the card has transaction history — data the form's
            // own zod-driven state doesn't carry (only id/name/
            // lastFourDigits), so it's read back from the row this
            // screen was opened with, matched by id.
            const meta = initialValues?.cards.find(
              (card) => card.id === cardValue.id && card.id !== "",
            );
            const hasTransactions = meta?.hasTransactions ?? false;
            const isActive = (meta?.status ?? "ACTIVE") === "ACTIVE";
            const isToggling = togglingCardId === cardValue.id;

            return (
              <div
                key={index}
                className="flex flex-col gap-2 rounded-md border border-border/60 p-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {t("cards.rowLabel", { index: index + 1 })}
                  </span>
                  {hasTransactions ? (
                    <button
                      type="button"
                      onClick={() => handleToggleCard(cardValue.id)}
                      disabled={isToggling}
                      className="text-xs text-primary transition-colors hover:underline disabled:pointer-events-none disabled:opacity-60"
                    >
                      {t(isActive ? "cards.disable" : "cards.enable")}
                    </button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => form.removeFieldValue("cards", index)}
                    >
                      <TrashIcon />
                      <span className="sr-only">{t("cards.remove")}</span>
                    </Button>
                  )}
                </div>

                <form.AppField name={`cards[${index}].name`}>
                  {(field) => (
                    <field.TextField
                      label={t("fields.card.name.label")}
                      placeholder={t("fields.card.name.placeholder")}
                    />
                  )}
                </form.AppField>

                <form.AppField name={`cards[${index}].lastFourDigits`}>
                  {(field) => (
                    <field.TextField
                      label={t("fields.card.lastFourDigits.label")}
                      placeholder={t("fields.card.lastFourDigits.placeholder")}
                    />
                  )}
                </form.AppField>

                <form.Field name={`cards[${index}].colorStyle`}>
                  {(field) => (
                    <div className="space-y-2 pt-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                        {t("fields.card.color.label", { fallback: "Color" })}
                      </label>
                      <ColorPicker
                        value={field.state.value}
                        onChange={(val) => field.handleChange(val)}
                      />
                    </div>
                  )}
                </form.Field>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => form.pushFieldValue("cards", emptyCardRow)}
          className="flex w-fit items-center gap-1.5 text-xs text-primary transition-colors hover:underline"
        >
          <PlusIcon className="size-3.5" />
          {t("cards.add")}
        </button>
      </div>

      <FormError title={t("toast.error")} description={serverError} />

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {isSubmitting && <SpinnerIcon className="size-4 animate-spin" />}
        {t(isEditing ? "dialog.edit.confirm" : "dialog.create.confirm")}
      </button>
    </form>
  );
}
