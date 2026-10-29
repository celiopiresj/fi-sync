"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { makeErrorMap } from "@/lib/zod/zod-error-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOpenFinanceMutations } from "../_hooks/use-open-finance";
import { connectionDefaults, connectionSchema } from "../_schema/schema";

export function ConnectionForm() {
  const t = useTranslations("scrn-open-finance");
  const tValidation = useTranslations("common.validation");
  const { add } = useOpenFinanceMutations();
  const [label, setLabel] = useState(connectionDefaults.label);
  const [itemId, setItemId] = useState(connectionDefaults.itemId);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    const parsed = connectionSchema.safeParse(
      { label, itemId },
      { error: makeErrorMap(tValidation) },
    );
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      const result = await add.mutateAsync(parsed.data);
      if (!result.error) {
        setLabel(connectionDefaults.label);
        setItemId(connectionDefaults.itemId);
      }
    } catch {
      /* Mutation surfaces toast error */
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="connection-label" className="text-sm font-medium">
          {t("fields.label.label")}
        </label>
        <Input
          id="connection-label"
          name="label"
          value={label}
          placeholder={t("fields.label.placeholder")}
          onChange={(e) => {
            setLabel(e.target.value);
            if (errors.label) setErrors((prev) => ({ ...prev, label: "" }));
          }}
        />
        {errors.label ? (
          <p className="text-xs text-negative">{errors.label}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="connection-item-id" className="text-sm font-medium">
          {t("fields.itemId.label")}
        </label>
        <Input
          id="connection-item-id"
          name="itemId"
          value={itemId}
          placeholder={t("fields.itemId.placeholder")}
          onChange={(e) => {
            setItemId(e.target.value);
            if (errors.itemId) setErrors((prev) => ({ ...prev, itemId: "" }));
          }}
        />
        {errors.itemId ? (
          <p className="text-xs text-negative">{errors.itemId}</p>
        ) : null}
      </div>
      <Button type="submit" disabled={add.isPending}>
        {t("buttons.add")}
      </Button>
    </form>
  );
}
