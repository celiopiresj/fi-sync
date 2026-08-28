"use client";

import type { AccountTypeOption } from "@/app/[locale]/(app)/accounts/_schema/schema";
import { AmountInput } from "@/components/form/amount-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  BankIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

export type OnboardingAccount = {
  name: string;
  type: AccountTypeOption;
  // Empty string when left blank, same "no value" convention
  // AccountFormValues itself uses. createAccount (accounts/actions.ts)
  // is what turns a non-empty value into the actual opening Transaction.
  initialBalance: string;
};

type AccountStepProps = {
  accounts: OnboardingAccount[];
  onAdd: (account: OnboardingAccount) => void;
  onUpdate: (index: number, account: OnboardingAccount) => void;
  onRemove: (index: number) => void;
};

const ACCOUNT_TYPES: AccountTypeOption[] = ["CHECKING", "SAVINGS", "CASH"];

// Mandatory step — hand-rolled local form (no TanStack Form), matching
// the reference implementation's shape: local state + a disabled-until-
// valid Add button + a running list with remove/edit, instead of reusing
// AccountForm. Field labels borrow scrn-accounts' own copy so they don't
// drift from the real Accounts screen. Editing (pencil loads an account
// back into the form, Add becomes Save/Cancel) mirrors cards-step.tsx's
// own shape.
export function AccountStep({
  accounts,
  onAdd,
  onUpdate,
  onRemove,
}: AccountStepProps) {
  const t = useTranslations("scrn-onboarding");
  const tCommon = useTranslations("common");
  const tAccounts = useTranslations("scrn-accounts");
  const format = useFormatter();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountTypeOption | null>(null);
  const [initialBalance, setInitialBalance] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEditing = editingIndex !== null;

  function resetForm() {
    setName("");
    setType(null);
    setInitialBalance("");
    setEditingIndex(null);
    setError(null);
  }

  function startEditing(index: number) {
    const account = accounts[index];
    setName(account.name);
    setType(account.type);
    setInitialBalance(account.initialBalance);
    setEditingIndex(index);
    setError(null);
  }

  function handleSubmit() {
    const trimmedName = name.trim();
    if (!trimmedName || !type) return;

    if (accounts.some((a, i) => a.name === trimmedName && i !== editingIndex)) {
      setError(t("steps.account.errors.duplicated"));
      return;
    }

    const value: OnboardingAccount = {
      name: trimmedName,
      type,
      initialBalance,
    };
    if (isEditing) {
      onUpdate(editingIndex, value);
    } else {
      onAdd(value);
    }
    resetForm();
  }

  return (
    <div className="flex gap-6 flex-wrap">
      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            {tAccounts("fields.name.label")}
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tAccounts("fields.name.placeholder")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            {tAccounts("fields.type.label")}
          </label>
          <ToggleGroup
            type="single"
            variant="outline"
            value={type ?? ""}
            onValueChange={(value) =>
              value && setType(value as AccountTypeOption)
            }
            className="grid w-full grid-cols-3">
            {ACCOUNT_TYPES.map((option) => (
              <ToggleGroupItem key={option} value={option} className="flex-1">
                {tAccounts(`fields.type.${option.toLowerCase()}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {type && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              {tAccounts("fields.initialBalance.label")}
            </label>
            <AmountInput
              value={initialBalance}
              onChange={setInitialBalance}
              placeholder={tAccounts("fields.initialBalance.placeholder")}
            />
            <p className="text-xs text-muted-foreground">
              {tAccounts("fields.initialBalance.hint")}
            </p>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleSubmit}
            disabled={!name.trim() || !type}
            className="flex-1">
            {isEditing ? null : <PlusIcon />}
            {isEditing ? tCommon("buttons.save") : t("buttons.add")}
          </Button>
          {isEditing && (
            <Button type="button" variant="ghost" onClick={resetForm}>
              {tCommon("buttons.cancel")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {accounts.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            <BankIcon className="size-8" />
            {t("steps.account.empty")}
          </div>
        ) : (
          accounts.map((account, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border p-3 min-w-sm",
                editingIndex === index ? "border-primary" : "border-border",
              )}>
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <BankIcon className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{account.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {tAccounts(`fields.type.${account.type.toLowerCase()}`)}
                    {account.initialBalance &&
                      ` • ${format.number(
                        Number(account.initialBalance.replace(",", ".")),
                        { style: "currency", currency: "BRL" },
                      )}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => startEditing(index)}>
                  <PencilSimpleIcon />
                  <span className="sr-only">{tCommon("buttons.edit")}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemove(index)}>
                  <TrashIcon />
                  <span className="sr-only">{t("buttons.remove")}</span>
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
