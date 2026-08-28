"use client";

import { AVAILABLE_COLORS, ColorPicker } from "@/components/form/color-picker";
import { PhoneInput } from "@/components/form/phone-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatCombinedPersonPhone,
  isValidPersonPhone,
} from "@/app/[locale]/(app)/people/_lib/phone";
import {
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export type OnboardingPerson = {
  name: string;
  phone: string;
  colorStyle: string;
};

type PeopleStepProps = {
  people: OnboardingPerson[];
  onAdd: (person: OnboardingPerson) => void;
  onUpdate: (index: number, person: OnboardingPerson) => void;
  onRemove: (index: number) => void;
};

// Optional, repeatable. Phone uses `PhoneInput` (src/components/form/
// phone-field.tsx) directly — the same live AsYouType formatting the real
// PhoneField gets, minus the TanStack Form binding, since this step is
// local state. `handleSubmit` below runs the same `isValidPersonPhone`
// check the real People screen's Zod refinement (refinePerson,
// people/_schema/schema.ts) enforces inline, rather than only deferring
// to createPerson's own server-side validation — this was a real,
// verified bug: an incomplete/invalid phone (easy to leave half-typed
// with no submit gate) reached the final onboarding submit fine, but
// createPerson then rejected it there, throwing and aborting the loop
// partway through — so people added *after* the bad one in the draft
// never got created, with no indication which entry was actually at
// fault.
export function PeopleStep({
  people,
  onAdd,
  onUpdate,
  onRemove,
}: PeopleStepProps) {
  const t = useTranslations("scrn-onboarding");
  const tCommon = useTranslations("common");
  const tPeople = useTranslations("scrn-people");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [colorStyle, setColorStyle] = useState(AVAILABLE_COLORS[0].class);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEditing = editingIndex !== null;

  function resetForm() {
    setName("");
    setPhone("");
    setColorStyle(AVAILABLE_COLORS[0].class);
    setEditingIndex(null);
    setError(null);
  }

  function startEditing(index: number) {
    const person = people[index];
    setName(person.name);
    setPhone(person.phone || "");
    setColorStyle(person.colorStyle);
    setEditingIndex(index);
    setError(null);
  }

  function handleAdd() {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (people.some((p, i) => p.name === trimmedName && i !== editingIndex)) {
      setError(t("steps.people.errors.duplicated"));
      return;
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone && !isValidPersonPhone(trimmedPhone)) {
      setError(tPeople("errors.invalidPhone"));
      return;
    }

    const value = { name: trimmedName, phone: trimmedPhone, colorStyle };
    if (isEditing) {
      onUpdate(editingIndex, value);
    } else {
      onAdd(value);
    }
    resetForm();
  }

  return (
    <div className="flex gap-6">
      <div className="flex flex-col gap-4 rounded-lg border border-border p-4 max-w-md">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            {tPeople("fields.name.label")}
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tPeople("fields.name.placeholder")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            {tPeople("fields.phone.label")}
          </label>
          <PhoneInput
            value={phone}
            onChange={setPhone}
            placeholder={tPeople("fields.phone.placeholder")}
            defaultCountry="BR"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            {tPeople("fields.color.label")}
          </label>
          <ColorPicker value={colorStyle} onChange={setColorStyle} />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleAdd}
            className="flex-1"
            disabled={!name.trim()}>
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

      <div className="min-w-sm flex flex-col gap-2">
        {people.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            <UserIcon className="size-8" />
            {t("steps.people.empty")}
          </div>
        ) : (
          people.map((person, index) => (
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
                    person.colorStyle,
                  )}>
                  <UserIcon className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{person.name}</p>
                  {person.phone && (
                    <p className="text-xs text-muted-foreground">
                      {formatCombinedPersonPhone(person.phone)}
                    </p>
                  )}
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
