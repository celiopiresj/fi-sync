"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import * as z from "zod";
import { zodValidator } from "./zod-validator";
import { makeErrorMap } from "./zod-error-map";

export function useZodValidator<T extends z.ZodType>(schema: T) {
  const t = useTranslations("common.validation");
  return useMemo(() => zodValidator(schema, makeErrorMap(t)), [schema, t]);
}
