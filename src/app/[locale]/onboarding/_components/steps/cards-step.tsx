"use client";

import type { CreditCardAccountFormValues } from "@/app/[locale]/(app)/cards/_schema/schema";
import { AmountInput } from "@/components/form/amount-field";
import { AVAILABLE_COLORS, ColorPicker } from "@/components/form/color-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  CreditCardIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export type OnboardingCard = CreditCardAccountFormValues;
type OtherCard = { name: string; lastFourDigits: string; colorStyle: string };

type CardsStepProps = {
  cards: OnboardingCard[];
  onAdd: (card: OnboardingCard) => void;
  onUpdate: (index: number, card: OnboardingCard) => void;
  onRemove: (index: number) => void;
};

const EMPTY_OTHER_CARD: OtherCard = {
  name: "",
  lastFourDigits: "",
  colorStyle: AVAILABLE_COLORS[0].class,
};

const EMPTY_FORM = {
  name: "",
  limit: "",
  closingDay: "",
  dueDay: "",
  // The account's own (primary) card — last-4-digits/color live as plain
  // top-level fields, not nested in the "other cards" list below, since
  // its name is already the account name (see handleSubmit).
  primaryLastFourDigits: "",
  primaryColorStyle: AVAILABLE_COLORS[0].class,
  // Any additional physical cards on the same account (e.g. an
  // "Adicional" card for someone else) — each needs its own name.
  otherCards: [] as OtherCard[],
};

// Optional, repeatable — same local-state + Add-button shape as
// account-step.tsx, plus editing (pencil loads a card back into the form,
// Add becomes Save/Cancel). Mirrors the real CreditCardForm's "at least
// one card, name tied to the account for the first one" behavior.
export function CardsStep({
  cards,
  onAdd,
  onUpdate,
  onRemove,
}: CardsStepProps) {
  const t = useTranslations("scrn-onboarding");
  const tCommon = useTranslations("common");
  const tCards = useTranslations("scrn-cards");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEditing = editingIndex !== null;
  const closingDayNumber = Number(form.closingDay);
  const dueDayNumber = Number(form.dueDay);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingIndex(null);
    setError(null);
  }

  function startEditing(index: number) {
    const card = cards[index];
    const [primary, ...others] = card.cards;
    setForm({
      name: card.name,
      limit: card.limit,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      primaryLastFourDigits: primary?.lastFourDigits ?? "",
      primaryColorStyle: primary?.colorStyle ?? AVAILABLE_COLORS[0].class,
      otherCards: others.map((c) => ({
        name: c.name,
        lastFourDigits: c.lastFourDigits,
        colorStyle: c.colorStyle ?? AVAILABLE_COLORS[0].class,
      })),
    });
    setEditingIndex(index);
    setError(null);
  }

  function updateOtherCard(index: number, patch: Partial<OtherCard>) {
    setForm((prev) => ({
      ...prev,
      otherCards: prev.otherCards.map((card, i) =>
        i === index ? { ...card, ...patch } : card,
      ),
    }));
  }

  function addOtherCard() {
    setForm((prev) => ({
      ...prev,
      otherCards: [...prev.otherCards, { ...EMPTY_OTHER_CARD }],
    }));
  }

  function removeOtherCard(index: number) {
    setForm((prev) => ({
      ...prev,
      otherCards: prev.otherCards.filter((_, i) => i !== index),
    }));
  }

  function handleSubmit() {
    const trimmedName = form.name.trim();
    if (!trimmedName || !form.limit) return;

    if (cards.some((c, i) => c.name === trimmedName && i !== editingIndex)) {
      setError(t("steps.cards.errors.duplicated"));
      return;
    }

    if (
      !form.closingDay ||
      !form.dueDay ||
      closingDayNumber < 1 ||
      closingDayNumber > 31 ||
      dueDayNumber < 1 ||
      dueDayNumber > 31
    ) {
      setError(t("steps.cards.errors.day"));
      return;
    }

    if (form.otherCards.some((c) => !c.name.trim())) {
      setError(t("steps.cards.errors.cardName"));
      return;
    }

    const allLastFourDigits = [
      form.primaryLastFourDigits,
      ...form.otherCards.map((c) => c.lastFourDigits),
    ];
    if (allLastFourDigits.some((digits) => digits && digits.length !== 4)) {
      setError(t("steps.cards.errors.lastFourDigits"));
      return;
    }

    const value: OnboardingCard = {
      name: trimmedName,
      limit: form.limit,
      closingDay: form.closingDay,
      dueDay: form.dueDay,
      cards: [
        {
          id: "",
          name: trimmedName,
          lastFourDigits: form.primaryLastFourDigits,
          colorStyle: form.primaryColorStyle,
        },
        ...form.otherCards.map((c) => ({
          id: "",
          name: c.name.trim(),
          lastFourDigits: c.lastFourDigits,
          colorStyle: c.colorStyle,
        })),
      ],
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
      <div className="flex flex-col gap-4 rounded-lg border border-border p-4 max-w-md">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            {tCards("fields.name.label")}
          </label>
          <Input
            value={form.name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder={tCards("fields.name.placeholder")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            {tCards("fields.limit.label")}
          </label>
          <AmountInput
            value={form.limit}
            onChange={(limit) => setForm((prev) => ({ ...prev, limit }))}
            placeholder={tCards("fields.limit.placeholder")}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              {tCards("fields.closingDay.label")}
            </label>
            <Input
              inputMode="numeric"
              value={form.closingDay}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  closingDay: e.target.value.replace(/\D/g, ""),
                }))
              }
              placeholder={tCards("fields.closingDay.placeholder")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              {tCards("fields.dueDay.label")}
            </label>
            <Input
              inputMode="numeric"
              value={form.dueDay}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  dueDay: e.target.value.replace(/\D/g, ""),
                }))
              }
              placeholder={tCards("fields.dueDay.placeholder")}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            {tCards("fields.card.lastFourDigits.label")}
          </label>
          <Input
            inputMode="numeric"
            maxLength={4}
            value={form.primaryLastFourDigits}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                primaryLastFourDigits: e.target.value
                  .replace(/\D/g, "")
                  .slice(0, 4),
              }))
            }
            placeholder={tCards("fields.card.lastFourDigits.placeholder")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            {tCards("fields.card.color.label")}
          </label>
          <ColorPicker
            value={form.primaryColorStyle}
            onChange={(primaryColorStyle) =>
              setForm((prev) => ({ ...prev, primaryColorStyle }))
            }
          />
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <p className="text-sm font-medium">
            {t("steps.cards.otherCardsTitle")}
          </p>

          {form.otherCards.length > 0 && (
            <div className="flex flex-col gap-3">
              {form.otherCards.map((otherCard, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-2 rounded-md border border-border/60 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {tCards("cards.rowLabel", { index: index + 2 })}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeOtherCard(index)}>
                      <TrashIcon />
                      <span className="sr-only">{tCards("cards.remove")}</span>
                    </Button>
                  </div>

                  <Input
                    value={otherCard.name}
                    onChange={(e) =>
                      updateOtherCard(index, { name: e.target.value })
                    }
                    placeholder={tCards("fields.card.name.placeholder")}
                  />

                  <Input
                    inputMode="numeric"
                    maxLength={4}
                    value={otherCard.lastFourDigits}
                    onChange={(e) =>
                      updateOtherCard(index, {
                        lastFourDigits: e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 4),
                      })
                    }
                    placeholder={tCards(
                      "fields.card.lastFourDigits.placeholder",
                    )}
                  />

                  <div className="flex flex-col gap-1.5 pt-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {tCards("fields.card.color.label")}
                    </label>
                    <ColorPicker
                      value={otherCard.colorStyle}
                      onChange={(colorStyle) =>
                        updateOtherCard(index, { colorStyle })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addOtherCard}
            className="flex w-fit items-center gap-1.5 text-xs text-primary transition-colors hover:underline">
            <PlusIcon className="size-3.5" />
            {tCards("cards.add")}
          </button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleSubmit}
            disabled={!form.name.trim() || !form.limit}
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

      <div className="flex min-w-sm flex-col gap-3">
        <CardPreview
          name={form.name || t("steps.cards.previewPlaceholder")}
          limit={form.limit}
          closingDay={form.closingDay}
          dueDay={form.dueDay}
          colorStyle={form.primaryColorStyle}
        />

        {cards.length > 0 && (
          <div className="flex flex-col gap-2">
            {cards.map((card, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border p-3",
                  editingIndex === index ? "border-primary" : "border-border",
                )}>
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full",
                      card.cards[0]?.colorStyle,
                    )}>
                    <CreditCardIcon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{card.name}</p>
                    <p className="text-xs text-muted-foreground">
                      R$ {card.limit} ·{" "}
                      {t("steps.cards.physicalCardsCount", {
                        count: card.cards.length,
                      })}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type CardPreviewProps = {
  name: string;
  limit: string;
  closingDay: string;
  dueDay: string;
  colorStyle: string;
};

// Live mockup of the card being filled in — same idea as the reference
// implementation's own preview, themed with fi-sync's AVAILABLE_COLORS
// palette instead of a bespoke theme map.
function CardPreview({
  name,
  limit,
  closingDay,
  dueDay,
  colorStyle,
}: CardPreviewProps) {
  const t = useTranslations("scrn-onboarding");

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl p-5 shadow-sm",
        colorStyle,
      )}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-base font-semibold">{name}</span>
        <CreditCardIcon className="size-6 shrink-0" />
      </div>
      <div>
        <span className="block text-xs font-semibold uppercase opacity-80">
          {t("steps.cards.previewLimit")}
        </span>
        <span className="text-lg font-bold tabular-nums">
          {limit ? `R$ ${limit}` : "—"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-current/20 pt-3 text-xs">
        <div>
          <span className="block font-semibold uppercase opacity-80">
            {t("steps.cards.previewClosingDay")}
          </span>
          <span>{closingDay || "--"}</span>
        </div>
        <div>
          <span className="block font-semibold uppercase opacity-80">
            {t("steps.cards.previewDueDay")}
          </span>
          <span>{dueDay || "--"}</span>
        </div>
      </div>
    </div>
  );
}
