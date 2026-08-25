"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PlusIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createPerson } from "@/app/[locale]/(app)/people/actions";
import { useInvalidateTransactionFormOptions } from "../../_hooks/use-transaction-form-options";

// Small "add a person on the spot" control, shared by the single-
// transaction form's Pessoa field (as its picker's footer) and its
// "dividir" section's Deve list (as a plain button), and by the batch
// table's Pessoa chip footer and its zero-People Empty state. Every
// call site gets its own open/closed state, but none of them duplicate
// the createPerson call or the invalidation that makes the new person
// show up elsewhere without a reload.
export function CreatePersonInline({
  label,
  triggerClassName,
  onCreated,
}: {
  label: string;
  triggerClassName?: string;
  onCreated: (person: { id: string; name: string }) => void;
}) {
  const t = useTranslations("scrn-transactions");
  const tPeople = useTranslations("scrn-people");
  const tCommon = useTranslations("common");
  const invalidateFormOptions = useInvalidateTransactionFormOptions();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;

    setIsCreating(true);
    const result = await createPerson({ name: trimmed, phone: "" });
    setIsCreating(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(tPeople("toast.created"));
    setName("");
    setIsOpen(false);
    invalidateFormOptions();
    if (result.person) onCreated(result.person);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center gap-1.5 text-left text-xs/relaxed text-primary transition-colors hover:underline",
          triggerClassName,
        )}
      >
        <PlusIcon className="size-3.5" />
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-1">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleCreate();
          }
        }}
        placeholder={t("splits.newPersonPlaceholder")}
        autoFocus
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          className="flex-1"
          onClick={handleCreate}
          disabled={isCreating || !name.trim()}
        >
          {tPeople("dialog.create.confirm")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setIsOpen(false);
            setName("");
          }}
        >
          {tCommon("buttons.cancel")}
        </Button>
      </div>
    </div>
  );
}
