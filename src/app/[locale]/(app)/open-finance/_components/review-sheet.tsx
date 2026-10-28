"use client";

import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useOpenFinanceReview } from "../_hooks/use-open-finance";
import { ReviewForm } from "./review-form";
import type { ReviewSheetProps } from "../_types/types";

export function ReviewSheet({ source, row, remaining, onClose, onProcessed }: ReviewSheetProps) {
  const t = useTranslations("scrn-open-finance");
  const common = useTranslations("common");
  const review = useOpenFinanceReview(source, row?.id ?? null);
  return (
    <Sheet open={Boolean(row)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="overflow-y-auto data-[side=right]:sm:max-w-lg" closeLabel={t("aria.close")}>
        <SheetHeader><SheetTitle>{t("dialog.create.title")}</SheetTitle><SheetDescription>{t("dialog.create.description")}</SheetDescription></SheetHeader>
        {row && <p className="px-6 text-sm text-muted-foreground">{t("dialog.create.remaining", { count: remaining })}</p>}
        {review.isPending && <p className="px-6" role="status">{common("status.loading")}</p>}
        {(review.isError || review.data?.error) && <p className="px-6 text-negative" role="alert">{review.data?.error ?? t("errors.provider.description")}</p>}
        {row && review.data?.data && <ReviewForm key={row.id} source={source} row={row} review={review.data.data} remaining={remaining} onClose={onClose} onProcessed={onProcessed} />}
      </SheetContent>
    </Sheet>
  );
}
