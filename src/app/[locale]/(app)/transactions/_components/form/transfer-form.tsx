"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useStore } from "@tanstack/react-form";
import { SpinnerIcon } from "@phosphor-icons/react";
import { useZodForm } from "@/lib/form/use-zod-form";
import { useAccountBalanceBreakdown } from "@/hooks/use-account-balance-breakdown";
import { FormError } from "@/components/form/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemGroup } from "@/components/ui/item";
import { isNextRedirectError } from "@/lib/next/is-redirect-error";
import { todayCalendarDate } from "@/lib/date";
import { formatPersonName } from "@/lib/format-person-name";
import { cn } from "@/lib/utils";
import { TRANSFERABLE_ACCOUNT_TYPES } from "@/lib/transfer-accounts";
import {
  emptyTransferFormValues,
  paymentMethodFormValues,
  refineTransfer,
  transferSchema,
  transferTargetValues,
  type TransferFormValues,
  type TransferTarget,
} from "../../_schema/schema";
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
} from "../../_types/types";
import { CreatePersonInline } from "./create-person-inline";

type TransferFormProps = {
  accounts: AccountOption[];
  categories: CategoryOption[];
  people: PersonOption[];
  // The user's default checking/savings/cash account, if any — becomes
  // the prefilled "De", same default the debit form starts from.
  defaultAccountId: string | null;
  // Which shape the form opens on. /accounts/[id] opens it straight on
  // "balance" with that account as the source; everywhere else it starts
  // where most transfers start.
  initialTarget?: TransferTarget;
  onSubmit: (values: TransferFormValues) => Promise<{ error: string | null }>;
  onSuccess: () => void;
};

// Both kinds of transferência behind one form (see transferSchema's own
// comment): the fields that only make sense for one target appear and
// disappear with the Tipo toggle, rather than two forms the user has to
// choose between up front.
export function TransferForm({
  accounts,
  people,
  defaultAccountId,
  initialTarget = "account",
  onSubmit,
  onSuccess,
}: TransferFormProps) {
  const t = useTranslations("scrn-transactions");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("common.validation");
  const format = useFormatter();
  const [serverError, setServerError] = useState<string | null>(null);

  // Same account set the server accepts (createTransfer), from the same
  // constant — so the picker can never offer an account the action then
  // rejects. Archived accounts stay out, as in every other picker.
  const transferAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          account.status === "ACTIVE" &&
          (TRANSFERABLE_ACCOUNT_TYPES as readonly string[]).includes(account.type),
      ),
    [accounts],
  );

  // "Com uma pessoa" starts from your own share — the common case is
  // sending your money to someone else.
  const selfPersonId = people.find((person) => person.isSelf)?.id ?? "";

  const schema = useMemo(
    () =>
      transferSchema.superRefine((value, ctx) =>
        refineTransfer(value, ctx, {
          required: tValidation("required"),
          sameAccount: t("transfer.errors.sameAccount"),
          samePersonAccount: t("transfer.errors.samePersonAccount"),
          amountRequired: tValidation("required"),
        }),
      ),
    [t, tValidation],
  );

  const form = useZodForm(schema, {
    defaultValues: {
      ...emptyTransferFormValues,
      target: initialTarget,
      // Computed per mount, not baked into the static empty values — a
      // form left open across midnight still gets the day it opened on.
      date: todayCalendarDate(),
      accountId: transferAccounts.some((account) => account.id === defaultAccountId)
        ? (defaultAccountId ?? "")
        : (transferAccounts[0]?.id ?? ""),
    } satisfies TransferFormValues,
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

  const target = useStore(form.store, (state) => state.values.target);
  const accountId = useStore(form.store, (state) => state.values.accountId);
  const toAccountId = useStore(form.store, (state) => state.values.toAccountId);
  const personId = useStore(form.store, (state) => state.values.personId);
  const toPersonId = useStore(form.store, (state) => state.values.toPersonId);
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  const isBalance = target === "balance";
  const isPerson = target === "person";

  // Every target reads the source account's breakdown: "balance" to
  // preview what will move, "account"/"person" to show what's there
  // before typing an amount (currentBalance below).
  const balanceQuery = useAccountBalanceBreakdown(accountId, true);
  const breakdown = balanceQuery.data ?? null;

  // The typed shapes' "how much is there" line: the chosen person's own
  // share of the chosen account ("com uma pessoa"), or the account's
  // whole balance ("entre minhas contas", which has no person). A person
  // missing from the breakdown simply has nothing on this account.
  const sourceAccountName = transferAccounts.find(
    (account) => account.id === accountId,
  )?.name;
  const selectedPersonName = people.find(
    (person) => person.id === personId,
  )?.name;
  const showCurrentBalance =
    !isBalance &&
    Boolean(sourceAccountName) &&
    (target === "account" || Boolean(selectedPersonName));
  const currentBalance =
    target === "person"
      ? (breakdown?.people.find((person) => person.personId === personId)
          ?.balance ?? 0)
      : (breakdown?.balance ?? 0);

  // What the server will move if this is submitted now. It reads the same
  // numbers again from the same helper when it posts, so this is a
  // preview, never the input.
  const balanceShare = !isBalance
    ? 0
    : personId
      ? (breakdown?.people.find((person) => person.personId === personId)
          ?.balance ?? 0)
      : (breakdown?.balance ?? 0);
  const balanceLeftBehind = (breakdown?.balance ?? 0) - balanceShare;

  // Picking as "De" the account already chosen as "Para" would make an
  // account-to-account transfer go nowhere — cleared rather than left for
  // the refine to flag. Not for "person": the same account twice is valid
  // there, between two different people.
  useEffect(() => {
    if (!isPerson && toAccountId && toAccountId === accountId) {
      form.setFieldValue("toAccountId", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, isPerson]);

  // The person pickers mean different things per target (whose share to
  // empty vs. the source of a person transfer), so a name carried across
  // the Tipo toggle is rarely still a valid answer.
  useEffect(() => {
    form.setFieldValue("personId", isPerson ? selfPersonId : "");
    form.setFieldValue("toPersonId", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // The description the server writes when this field is left blank —
  // shown as the placeholder so an empty field reads as "this is what it
  // will say", not as something missing. For "person" it names whichever
  // side differs (the other person, or the other bank for one person
  // moving banks) — same rule as createTransfer.
  const toAccountName = transferAccounts.find(
    (account) => account.id === toAccountId,
  )?.name;
  const toPersonName = people.find((person) => person.id === toPersonId)?.name;
  const counterpartName = isPerson
    ? toPersonId && toPersonId === personId
      ? toAccountName
      : toPersonName && formatPersonName(toPersonName)
    : toAccountName;
  const descriptionPlaceholder = counterpartName
    ? t(isBalance ? "transfer.balanceDescriptionTo" : "transfer.descriptionTo", {
        name: counterpartName,
      })
    : t("transfer.fields.descriptionOptional");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <form.AppField name="target">
        {(field) => (
          <field.ToggleGroupField
            label={t("transfer.target.label")}
            options={transferTargetValues.map((value) => ({
              value,
              label: t(`transfer.target.${value}`),
            }))}
          />
        )}
      </form.AppField>

      {isBalance ? (
        // No amount field: the figure is the account's own balance, so it
        // is shown rather than asked for.
        <div className="flex flex-col gap-1 rounded-md border border-border p-3">
          <span className="text-xs text-muted-foreground">
            {t("transfer.balancePreview.label")}
          </span>
          {accountId && balanceQuery.isPending ? (
            <span className="text-sm text-muted-foreground">
              {t("transfer.balancePreview.loading")}
            </span>
          ) : balanceShare === 0 ? (
            <span className="text-sm text-muted-foreground">
              {t("transfer.balancePreview.empty")}
            </span>
          ) : (
            <>
              <span
                className={cn(
                  "text-2xl font-bold tabular-nums",
                  balanceShare < 0 ? "text-negative" : "text-positive",
                )}
              >
                {format.number(balanceShare, {
                  style: "currency",
                  currency: "BRL",
                })}
              </span>
              {personId && balanceLeftBehind !== 0 && (
                <span className="text-xs text-muted-foreground">
                  {t("transfer.balancePreview.leftBehind", {
                    value: format.number(balanceLeftBehind, {
                      style: "currency",
                      currency: "BRL",
                    }),
                  })}
                </span>
              )}
            </>
          )}
        </div>
      ) : (
        <form.AppField name="amount">
          {(field) => (
            <field.AmountField
              label={t("fields.amount.label")}
              placeholder={t("fields.amount.placeholder")}
              allowExpression
              size="lg"
            />
          )}
        </form.AppField>
      )}

      <ItemGroup className="gap-0 divide-y rounded-md border border-border">
        <form.AppField name="date">
          {(field) => (
            <field.DatePickerRowField
              label={t("fields.date.label")}
              placeholder={t("fields.choosePlaceholder")}
              formatDisplay={(value) =>
                format.dateTime(value, { dateStyle: "long" })
              }
            />
          )}
        </form.AppField>

        {isPerson && (
          <form.AppField name="personId">
            {(field) => (
              <field.PickerRowField
                label={t("transfer.fields.fromPerson")}
                placeholder={t("fields.choosePlaceholder")}
                options={people.map((person) => ({
                  value: person.id,
                  label: person.name,
                }))}
                formatDisplay={formatPersonName}
              />
            )}
          </form.AppField>
        )}

        <form.AppField name="accountId">
          {(field) => (
            <field.PickerRowField
              label={t(isPerson ? "transfer.fields.fromAccount" : "transfer.fields.from")}
              placeholder={t("fields.choosePlaceholder")}
              options={transferAccounts.map((account) => ({
                value: account.id,
                label: account.name,
              }))}
            />
          )}
        </form.AppField>

        {isPerson && (
          <form.AppField name="toPersonId">
            {(field) => (
              <field.PickerRowField
                label={t("transfer.fields.toPerson")}
                placeholder={t("fields.choosePlaceholder")}
                options={people.map((person) => ({
                  value: person.id,
                  label: person.name,
                }))}
                formatDisplay={formatPersonName}
                footer={
                  <div className="flex flex-col gap-1.5 border-t border-border p-1.5 pt-2">
                    <CreatePersonInline
                      label={t("splits.newPerson")}
                      triggerClassName="px-1.5"
                      onCreated={(person) => field.handleChange(person.id)}
                    />
                  </div>
                }
              />
            )}
          </form.AppField>
        )}

        <form.AppField name="toAccountId">
          {(field) => (
            <field.PickerRowField
              label={t(isPerson ? "transfer.fields.toAccount" : "transfer.fields.to")}
              placeholder={t("fields.choosePlaceholder")}
              // Between accounts "De" is never a valid "Para" — left out
              // rather than offered and then rejected. A person transfer
              // may stay on the same account (between two people).
              options={transferAccounts
                .filter((account) => isPerson || account.id !== accountId)
                .map((account) => ({
                  value: account.id,
                  label: account.name,
                }))}
            />
          )}
        </form.AppField>

        {isBalance && (
          <form.AppField name="personId">
            {(field) => (
              <field.PickerRowField
                label={t("transfer.fields.person")}
                placeholder={t("fields.choosePlaceholder")}
                // Empty is a real answer here ("todas as pessoas"), not an
                // unanswered field — hence emptyOption rather than the
                // accent placeholder.
                emptyOption={{ label: t("transfer.fields.allPeople") }}
                // Only who actually has a share on this account: someone
                // with nothing here has nothing to move.
                options={(breakdown?.people ?? []).map((person) => ({
                  value: person.personId,
                  label: person.name,
                }))}
                formatDisplay={formatPersonName}
              />
            )}
          </form.AppField>
        )}

        <form.AppField name="paymentMethod">
          {(field) => (
            <field.PickerRowField
              label={t("fields.paymentMethod.label")}
              placeholder={t("fields.choosePlaceholder")}
              options={paymentMethodFormValues.map((method) => ({
                value: method,
                label: t(`fields.paymentMethod.${method}`),
              }))}
            />
          )}
        </form.AppField>
      </ItemGroup>

      {showCurrentBalance && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {target === "person" && selectedPersonName
              ? t("transfer.currentBalance.person", {
                  name: formatPersonName(selectedPersonName),
                  account: sourceAccountName ?? "",
                })
              : t("transfer.currentBalance.account", {
                  account: sourceAccountName ?? "",
                })}
          </span>
          {balanceQuery.isPending ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {t("transfer.balancePreview.loading")}
            </span>
          ) : (
            <span
              className={cn(
                "shrink-0 text-sm font-semibold tabular-nums",
                currentBalance < 0 && "text-negative",
              )}
            >
              {format.number(currentBalance, {
                style: "currency",
                currency: "BRL",
              })}
            </span>
          )}
        </div>
      )}

      <form.AppField name="description">
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={field.name} className="text-sm font-medium">
              {t("fields.description.label")}
            </label>
            <Input
              id={field.name}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder={descriptionPlaceholder}
            />
          </div>
        )}
      </form.AppField>

      <p className="text-xs text-muted-foreground">
        {t(`transfer.hint.${target}`)}
      </p>

      <FormError title={t("toast.error")} description={serverError} />

      <Button
        type="submit"
        size="lg"
        // Nothing to move is a dead end, so the button says so by being
        // unavailable instead of failing on submit.
        disabled={isSubmitting || (isBalance && balanceShare === 0)}
        className="w-full"
      >
        {isSubmitting && <SpinnerIcon className="size-4 animate-spin" />}
        {t("transfer.confirm")}
      </Button>
    </form>
  );
}
