import { getTranslations } from "next-intl/server";
import { OpenFinanceError } from "@/lib/open-finance/schema";
import type { MappingConflict } from "@/lib/open-finance/types";

export function mappingConflictInfo(error: unknown): MappingConflict | null {
  if (!(error instanceof OpenFinanceError) || error.code !== "mappingConflict" || !error.values?.sourceId) return null;
  return { sourceId: error.values.sourceId, source: error.values.source, account: error.values.account, canReplace: error.values.canReplace === "true" };
}

export async function openFinanceError(error: unknown) {
  const t = await getTranslations("scrn-open-finance");
  const code = error instanceof OpenFinanceError ? error.code : "provider";
  return t(`errors.${code}.description`, error instanceof OpenFinanceError ? error.values : undefined);
}
