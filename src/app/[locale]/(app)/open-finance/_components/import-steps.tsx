"use client";

import { useTranslations } from "next-intl";
import { CheckIcon } from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { importSteps } from "../_lib/import-steps";
import type { ImportStepsProps } from "../_types/types";

export function ImportSteps(props: ImportStepsProps) {
  const t = useTranslations("scrn-open-finance");
  return <Card className="py-0"><CardContent className="px-4 py-4 sm:px-5"><ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {importSteps(props).map((step) => <li key={step.key} aria-current={step.current ? "step" : undefined} className={cn("flex items-center gap-2.5 text-xs font-medium text-muted-foreground", step.current && "text-foreground")}>
      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs", step.done && "bg-primary text-primary-foreground", step.current && "border-2 border-primary bg-background text-primary")}>{step.done ? <CheckIcon className="size-3.5" /> : step.number}</span>{t(`steps.${step.key}`)}
    </li>)}
  </ol></CardContent></Card>;
}
