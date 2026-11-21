"use client";

import { useTranslations } from "next-intl";
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

type BalanceVisibilityToggleProps = {
  visible: boolean;
  onToggle: () => void;
};

export function BalanceVisibilityToggle({ visible, onToggle }: BalanceVisibilityToggleProps) {
  const t = useTranslations("scrn-home.aria");

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onToggle}
      aria-pressed={!visible}
      aria-label={t(visible ? "hideBalances" : "showBalances")}
      className="shrink-0 text-muted-foreground shadow-xs"
    >
      {visible ? <EyeIcon className="size-5" /> : <EyeSlashIcon className="size-5" />}
    </Button>
  );
}
