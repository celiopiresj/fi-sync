"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowsLeftRightIcon,
  CaretRightIcon,
  CreditCardIcon,
  FileArrowUpIcon,
  ListChecksIcon,
  SpinnerIcon,
  XIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useQuickAddTransactionOptions } from "@/hooks/use-quick-add-transaction-options";
import { useQuickAddTransactionMutations } from "@/hooks/use-quick-add-transaction-mutations";
import { DebitTransactionForm } from "./debit-transaction-form";
import { CreditTransactionForm } from "./credit-transaction-form";
import { BatchTransactionMobile } from "./batch-transaction-mobile";
import { ImportStatementScreen } from "../import/import-statement-screen";

type Step = "choose" | "debit" | "credit" | "batch" | "import";

type AddTransactionDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// The FAB's "nova transação" bottom sheet (mounted once by
// MobileNavShell). Deliberately just a mobile-friendly entry point onto
// the exact same forms/Server Actions/validation /transactions itself
// uses (DebitTransactionForm/CreditTransactionForm/createTransactionsBatch)
// — no custom amount keypad or bespoke UI, per the design decision
// behind this screen.
export function AddTransactionDrawer({ open, onOpenChange }: AddTransactionDrawerProps) {
  const t = useTranslations("scrn-transactions");
  const [step, setStep] = useState<Step>("choose");
  const { data: options, isLoading } = useQuickAddTransactionOptions(open);
  const { submitDebit, submitCredit, submitBatch, submitCreditBatch } =
    useQuickAddTransactionMutations();

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setStep("choose");
    onOpenChange(nextOpen);
  }

  function handleBatchSuccess(count: number) {
    toast.success(t("toast.batchCreated", { count }));
    handleOpenChange(false);
  }

  // Everything past the chooser is a full-screen page rather than a
  // sheet — see the DrawerContent className below.
  const isFormStep = step !== "choose";

  return (
    <Drawer
      direction="bottom"
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DrawerContent
        closeLabel={t("aria.close")}
        // The form step is a full-screen page, not a sheet: it drops the
        // swipe-away grab bar and the floating top-right close for a
        // close control docked in its own header instead. The chooser
        // stays a real bottom sheet and keeps both.
        showDragHandle={!isFormStep}
        showCloseButton={!isFormStep}
        className={cn(
          "flex flex-col",
          // Only the form fills the screen — the chooser is two rows and
          // stays at the primitive's content height, so picking a type
          // is a glance rather than a full-screen takeover.
          isFormStep && [
            // DrawerContent caps a bottom drawer at 80vh and pushes it 6rem
            // down via its own `data-[vaul-drawer-direction=bottom]:max-h-[80vh]`
            // / `:mt-24` rules, so the override repeats that same
            // `data-[vaul-drawer-direction=bottom]:` prefix (AGENTS.md's
            // Radix/Vaul override rule). `max-h-dvh`, specifically, and not
            // `max-h-none`: tailwind-merge does not treat `max-h-none` as
            // conflicting with `max-h-[80vh]`, so that pair both survives
            // into the DOM at equal specificity and only stylesheet order
            // decides the winner. `max-h-dvh` is deduped, which drops the
            // cap outright. `dvh` over `vh`/`full` because in the browser
            // (not installed) the collapsing URL bar makes `100vh` taller
            // than what is actually on screen.
            "h-dvh data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-dvh",
            // Full-bleed on top of full-height: the primitive floats the
            // sheet 2 units inside the viewport and paints its surface as a
            // rounded, bordered `before:` layer inset by the same amount.
            // At full screen that reads as a card with the overlay showing
            // through its corners, so the inset and the rounding go too.
            "p-0 before:inset-0 before:rounded-none before:border-0",
          ],
        )}
      >
        {step === "choose" && (
          <>
            <DrawerHeader>
              <DrawerTitle>{t("quickAdd.title")}</DrawerTitle>
              <DrawerDescription>{t("quickAdd.subtitle")}</DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col gap-2 px-4 pb-6">
              <button
                type="button"
                onClick={() => setStep("debit")}
                className="flex items-center gap-3 rounded-lg border border-border p-3.5 text-left"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-positive/10 text-positive">
                  <ArrowsLeftRightIcon className="size-5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">
                    {t("quickAdd.debitOption.title")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("quickAdd.debitOption.subtitle")}
                  </span>
                </div>
                <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => setStep("credit")}
                className="flex items-center gap-3 rounded-lg border border-border p-3.5 text-left"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <CreditCardIcon className="size-5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">
                    {t("quickAdd.creditOption.title")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("quickAdd.creditOption.subtitle")}
                  </span>
                </div>
                <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => setStep("batch")}
                className="flex items-center gap-3 rounded-lg border border-border p-3.5 text-left"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ListChecksIcon className="size-5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">
                    {t("quickAdd.batchOption.title")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("quickAdd.batchOption.subtitle")}
                  </span>
                </div>
                <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => setStep("import")}
                className="flex items-center gap-3 rounded-lg border border-border p-3.5 text-left"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileArrowUpIcon className="size-5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">
                    {t("quickAdd.importOption.title")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("quickAdd.importOption.subtitle")}
                  </span>
                </div>
                <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </div>
          </>
        )}

        {step === "batch" &&
          (isLoading || !options ? (
            <div className="flex flex-1 items-center justify-center">
              <SpinnerIcon className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            // Renders its own header and sticky footer (its subtitle and
            // totals both count rows, which is state it owns), so unlike
            // the two single-transaction steps it isn't wrapped in a
            // DrawerHeader here.
            <BatchTransactionMobile
              accounts={options.accounts}
              categories={options.categories}
              people={options.people}
              defaultPersonId={options.defaultPersonId}
              onSubmit={submitBatch}
              onSuccess={handleBatchSuccess}
            />
          ))}

        {step === "import" &&
          (isLoading || !options ? (
            <div className="flex flex-1 items-center justify-center">
              <SpinnerIcon className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            // Same "renders its own header and footer" arrangement as the
            // batch step above, for the same reason: its header changes
            // with the step it is on (escolher origem vs. conferir).
            // That visible title isn't a DrawerTitle, though — the screen
            // is shared with /transactions' sheet, which has no Vaul
            // context at all — so the accessible name Radix requires on
            // the content is supplied here instead.
            <>
              <DrawerTitle className="sr-only">{t("import.title")}</DrawerTitle>
              <ImportStatementScreen
                accounts={options.accounts}
                categories={options.categories}
                people={options.people}
                defaultPersonId={options.defaultPersonId}
                onSubmitDebit={submitBatch}
                onSubmitCredit={submitCreditBatch}
                onSuccess={handleBatchSuccess}
                onClose={() => handleOpenChange(false)}
              />
            </>
          ))}

        {(step === "debit" || step === "credit") && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <DrawerHeader className="flex-row items-center gap-2 space-y-0 pb-2">
              <DrawerClose asChild>
                <Button variant="ghost" size="icon-sm" aria-label={t("aria.close")}>
                  <XIcon />
                </Button>
              </DrawerClose>
              <DrawerTitle>
                {t(step === "debit" ? "dialog.create.title" : "dialog.createCredit.title")}
              </DrawerTitle>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {isLoading || !options ? (
                <div className="flex items-center justify-center py-10">
                  <SpinnerIcon className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : step === "debit" ? (
                <DebitTransactionForm
                  isEditing={false}
                  initialValues={null}
                  accounts={options.accounts}
                  categories={options.categories}
                  people={options.people}
                  defaultPersonId={options.defaultPersonId}
                  onSubmit={submitDebit}
                  onSuccess={() => handleOpenChange(false)}
                />
              ) : (
                <CreditTransactionForm
                  isEditing={false}
                  initialValues={null}
                  accounts={options.accounts}
                  categories={options.categories}
                  people={options.people}
                  defaultPersonId={options.defaultPersonId}
                  onSubmit={submitCredit}
                  onSuccess={() => handleOpenChange(false)}
                />
              )}
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
