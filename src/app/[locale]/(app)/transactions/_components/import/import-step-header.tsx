"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { XIcon } from "@phosphor-icons/react";

type ImportStepHeaderProps = {
  // Null when the container already shows the title — /transactions'
  // sheet has it in its own SheetHeader, while the FAB drawer hands the
  // whole surface over to this screen and has nowhere else to put it.
  title: string | null;
  subtitle?: string;
  // Same split: the drawer suppresses its floating close control on a
  // full-screen step (see AddTransactionDrawer) so the close lives here
  // instead; SheetContent draws its own, so the sheet passes nothing.
  onClose?: () => void;
};

// The one header both import steps share. Renders nothing at all when
// the container supplies every piece of it, which is what keeps the
// desktop sheet from showing the title twice.
export function ImportStepHeader({
  title,
  subtitle,
  onClose,
}: ImportStepHeaderProps) {
  const t = useTranslations("scrn-transactions");

  if (!title && !subtitle && !onClose) return null;

  return (
    <header className="flex shrink-0 items-center gap-2 px-4 py-3">
      {onClose && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("aria.close")}
          onClick={onClose}
        >
          <XIcon />
        </Button>
      )}
      <div className="flex min-w-0 flex-col">
        {title && <p className="text-base font-semibold">{title}</p>}
        {subtitle && (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        )}
      </div>
    </header>
  );
}
