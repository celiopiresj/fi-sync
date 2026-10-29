"use client";

import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useOpenFinanceReview } from "../_hooks/use-open-finance";
import { sourceDestination } from "../_lib/options";
import { ReviewForm } from "./review-form";
import type { Review, ReviewSheetProps } from "../_types/types";

export function ReviewSheet({
  source,
  row,
  remaining,
  accounts = [],
  categories = [],
  people = [],
  defaultPersonId = "",
  onClose,
  onProcessed,
}: ReviewSheetProps) {
  const t = useTranslations("scrn-open-finance");
  const common = useTranslations("common");
  const reviewQuery = useOpenFinanceReview(source, row?.id ?? null);
  const { account, card } = sourceDestination(source, accounts);

  const fallbackReview: Review | null =
    row && row.amount !== null
      ? {
          matches: [],
          categories,
          people,
          defaultPersonId,
          paymentMethod: row.paymentMethod ?? "",
          destination: account?.name ?? "",
          cardName: card?.name ?? "",
          installmentNumber: row.installmentNumber ?? null,
          installmentCount: row.installmentCount ?? null,
          destinationSelection: {
            accountId: source.accountId ?? "",
            cardId: source.cardId ?? "",
            fromDate: source.fromDate ?? "",
          },
          credit: source.type === "CREDIT",
          pending: row.status === "PENDING",
          payment: row.payment,
          description: row.description,
          amount: row.amount,
          date: row.date,
          closingDate: "",
          dueDate: "",
        }
      : null;

  const resolvedReview = reviewQuery.data?.data ?? fallbackReview;

  return (
    <Sheet
      open={Boolean(row)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        className="overflow-y-auto data-[side=right]:sm:max-w-lg"
        closeLabel={t("aria.close")}
      >
        <SheetHeader>
          <SheetTitle>{t("dialog.create.title")}</SheetTitle>
          <SheetDescription>{t("dialog.create.description")}</SheetDescription>
        </SheetHeader>
        {row && (
          <p className="px-6 text-sm text-muted-foreground">
            {t("dialog.create.remaining", { count: remaining })}
          </p>
        )}
        {reviewQuery.isPending && !resolvedReview && (
          <p className="px-6" role="status">
            {common("status.loading")}
          </p>
        )}
        {(reviewQuery.isError || reviewQuery.data?.error) && (
          <p className="px-6 text-negative" role="alert">
            {reviewQuery.data?.error ?? t("errors.provider.description")}
          </p>
        )}
        {row &&
          resolvedReview &&
          !reviewQuery.isError &&
          !reviewQuery.data?.error && (
            <ReviewForm
              key={row.id}
              source={source}
              row={row}
              review={resolvedReview}
              remaining={remaining}
              onClose={onClose}
              onProcessed={onProcessed}
            />
          )}
      </SheetContent>
    </Sheet>
  );
}
