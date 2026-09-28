"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useStore } from "@tanstack/react-form";
import { useZodForm } from "@/lib/form/use-zod-form";
import { FormError } from "@/components/form/form-error";
import { isNextRedirectError } from "@/lib/next/is-redirect-error";
import { todayCalendarDate } from "@/lib/date";
import {
  investmentMovementSchema,
  investmentMovementKindValues,
  refineInvestmentMovement,
  emptyInvestmentMovementFormValues,
  type InvestmentMovementFormValues,
  type InvestmentMovementKind,
} from "../../_schema/schema";
import { formatPersonName } from "@/lib/format-person-name";
import type {
  MovementPersonOption,
  TransferAccountOption,
} from "../../_types/types";

type MovementFormProps = {
  initialKind: InvestmentMovementKind;
  // Used only to block an obviously invalid withdrawal (amount >
  // balance) client-side; the server doesn't repeat this check (see
  // createInvestmentMovement, investments/actions.ts) — same light-touch
  // validation spirit the rest of this app's forms use.
  accountBalance: number;
  // Checking/savings/cash accounts eligible as the "other side" of the
  // transfer (see the transferAccountId field below) — CONTRIBUTION and
  // WITHDRAWAL need one, YIELD never shows the picker at all.
  transferAccounts: TransferAccountOption[];
  // Everyone the movement can be attributed to. The picker only shows up
  // once there's more than just the user — with a single self Person
  // every movement is implicitly theirs, so a picker with nothing to
  // choose would be noise (same gating as the transaction forms').
  people: MovementPersonOption[];
  onSubmit: (
    values: InvestmentMovementFormValues,
  ) => Promise<{ error: string | null }>;
  onSuccess: () => void;
};

export function MovementForm({
  initialKind,
  accountBalance,
  transferAccounts,
  people,
  onSubmit,
  onSuccess,
}: MovementFormProps) {
  const t = useTranslations("scrn-investments");
  const tCommon = useTranslations("common");
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      investmentMovementSchema.superRefine((value, ctx) => {
        refineInvestmentMovement(value, ctx, {
          messages: { transferAccountRequired: t("movement.errors.transferAccountRequired") },
        });
        if (value.kind === "WITHDRAWAL" && value.amount > accountBalance) {
          ctx.addIssue({
            code: "custom",
            path: ["amount"],
            message: t("movement.fields.amount.exceedsBalance"),
          });
        }
        // Same "nothing actually changed" guard createInvestmentMovement
        // enforces server-side (investments/actions.ts) — repeated here
        // so the user sees it inline instead of only after a round trip.
        // `accountBalance` is the same figure the field was pre-filled
        // with on switching to "Rendimento" (see the effect below), so
        // an untouched field would otherwise silently fail server-side.
        if (value.kind === "YIELD" && Math.abs(value.amount - accountBalance) < 0.01) {
          ctx.addIssue({
            code: "custom",
            path: ["amount"],
            message: t("movement.errors.noChange"),
          });
        }
      }),
    [accountBalance, t],
  );

  const form = useZodForm(schema, {
    defaultValues: {
      ...emptyInvestmentMovementFormValues,
      kind: initialKind,
      date: todayCalendarDate(),
      transferAccountId: transferAccounts.find((account) => account.isDefault)?.id ?? "",
      // Most movements are the user's own money, so the self Person is
      // where the picker starts — same default every other person field
      // in the app uses.
      personId: people.find((person) => person.isSelf)?.id ?? "",
    } as InvestmentMovementFormValues,
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        const result = await onSubmit(value);
        if (result?.error) {
          setServerError(result.error);
        } else {
          onSuccess();
        }
      } catch (err) {
        if (isNextRedirectError(err)) throw err;
        setServerError(tCommon("errorGeneric"));
      }
    },
  });

  const kindValue = useStore(form.store, (state) => state.values.kind);

  // Switching to "Rendimento" pre-fills the amount field with the
  // current balance — the user is about to type the account's NEW total
  // value (createInvestmentMovement computes the actual posted amount as
  // the difference), so starting from the current figure means editing
  // just the part that changed instead of looking the balance up
  // separately. Only fires on the actual transition into YIELD, not on
  // every render while it's already selected — a `ref` tracks the
  // previous kind since this needs to run as a reaction to a value
  // change, not be recomputed from render inputs alone.
  const previousKindRef = useRef(initialKind);
  useEffect(() => {
    if (kindValue === "YIELD" && previousKindRef.current !== "YIELD") {
      form.setFieldValue("amount", accountBalance.toFixed(2).replace(".", ","));
    }
    previousKindRef.current = kindValue;
  }, [kindValue, accountBalance, form]);

  const isYield = kindValue === "YIELD";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <form.AppField name="kind">
        {(field) => (
          <field.SelectField
            label={t("movement.fields.kind.label")}
            placeholder={t("movement.fields.kind.label")}
            options={investmentMovementKindValues.map((kind) => ({
              value: kind,
              label: t(`movement.fields.kind.${kind.toLowerCase()}`),
            }))}
          />
        )}
      </form.AppField>

      <form.AppField name="amount">
        {(field) => (
          <field.AmountField
            label={t(
              isYield
                ? "movement.fields.currentValue.label"
                : "movement.fields.amount.label",
            )}
            placeholder={t(
              isYield
                ? "movement.fields.currentValue.placeholder"
                : "movement.fields.amount.placeholder",
            )}
          />
        )}
      </form.AppField>

      {isYield && (
        <p className="-mt-2 text-xs text-muted-foreground">
          {t("movement.fields.currentValue.hint")}
        </p>
      )}

      {!isYield && (
        <form.AppField name="transferAccountId">
          {(field) => (
            <field.SelectField
              label={t(
                kindValue === "WITHDRAWAL"
                  ? "movement.fields.transferAccount.labelWithdrawal"
                  : "movement.fields.transferAccount.labelContribution",
              )}
              placeholder={t("movement.fields.transferAccount.placeholder")}
              options={transferAccounts.map((account) => ({
                value: account.id,
                label: account.name,
              }))}
            />
          )}
        </form.AppField>
      )}

      {people.length > 1 && (
        <form.AppField name="personId">
          {(field) => (
            <field.SelectField
              label={t("movement.fields.person.label")}
              placeholder={t("movement.fields.person.placeholder")}
              options={people.map((person) => ({
                value: person.id,
                label: formatPersonName(person.name),
              }))}
            />
          )}
        </form.AppField>
      )}

      {people.length > 1 && (
        <p className="-mt-2 text-xs text-muted-foreground">
          {t(
            isYield
              ? "movement.fields.person.hintYield"
              : "movement.fields.person.hintTransfer",
          )}
        </p>
      )}

      <form.AppField name="date">
        {(field) => <field.DateField label={t("movement.fields.date.label")} />}
      </form.AppField>

      <form.AppField name="description">
        {(field) => (
          <field.TextField
            label={t("movement.fields.description.label")}
            placeholder={t(`movement.defaultDescription.${kindValue.toLowerCase()}`)}
          />
        )}
      </form.AppField>

      <FormError title={t("toast.error")} description={serverError} />

      <form.AppForm>
        <form.SubmitButton
          label={t("movement.dialog.confirm")}
          submittingLabel={t("movement.dialog.confirm")}
        />
      </form.AppForm>
    </form>
  );
}
