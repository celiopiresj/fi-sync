"use client";

import { useTranslations } from "next-intl";
import { WarningCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemGroup } from "@/components/ui/item";
import { useMappingForm } from "../_hooks/use-mapping-form";
import { mappingAccountOptions, mappingCardOptions } from "../_lib/options";
import { PickerRow } from "./picker-row";
import type { MappingFormProps } from "../_types/types";

export function MappingForm(props: MappingFormProps) {
  const { source, accounts, onCancel } = props;
  const t = useTranslations("scrn-open-finance");
  const {
    accountId,
    cardId,
    fromDate,
    fieldErrors,
    changeAccount,
    changeCard,
    changeFromDate,
    submit,
    clear,
    pending,
    error,
    failed,
  } = useMappingForm(props);

  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">{t("cards.mapping.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("cards.mapping.description")}
        </p>
      </div>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <fieldset disabled={pending} className="flex min-w-0 flex-col gap-4">
          <ItemGroup className="gap-0 divide-y rounded-md border border-border">
            <PickerRow
              label={t("fields.account.label")}
              placeholder={t("fields.account.placeholder")}
              value={accountId}
              onChange={changeAccount}
              options={mappingAccountOptions(source, accounts)}
              disabled={pending}
              error={fieldErrors.accountId}
            />
            {source.type === "CREDIT" && (
              <PickerRow
                label={t("fields.card.label")}
                placeholder={t("fields.card.placeholder")}
                value={cardId}
                onChange={changeCard}
                options={mappingCardOptions(accountId, accounts)}
                disabled={pending}
                error={fieldErrors.cardId}
              />
            )}
          </ItemGroup>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`mapping-from-date-${source.id}`} className="text-sm font-medium">
              {t("fields.from.label")}
            </label>
            <Input
              id={`mapping-from-date-${source.id}`}
              name="fromDate"
              type="date"
              value={fromDate}
              onChange={(event) => changeFromDate(event.target.value)}
              disabled={pending}
            />
            {fieldErrors.fromDate ? (
              <p className="text-xs text-negative">{fieldErrors.fromDate}</p>
            ) : null}
          </div>
          {(error || failed) && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning"
            >
              <WarningCircleIcon className="mt-0.5 size-4 shrink-0" />
              {error ?? t("errors.provider.description")}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {t("cards.mapping.editing")}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="submit"
              disabled={pending || source.currency !== "BRL"}
            >
              {t("buttons.saveMapping")}
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={onCancel}
              >
                {t("cards.mapping.cancel")}
              </Button>
            )}
            {source.accountId && (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => void clear()}
              >
                {t("cards.mapping.clear")}
              </Button>
            )}
          </div>
        </fieldset>
      </form>
    </div>
  );
}
