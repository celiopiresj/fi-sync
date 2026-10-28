import { getTranslations } from "next-intl/server";
import { OpenFinanceError } from "@/lib/open-finance/schema";

export async function openFinanceError(error: unknown) {
  const t = await getTranslations("scrn-open-finance");
  const code = error instanceof OpenFinanceError ? error.code : "provider";
  return t(`errors.${code}.description`, error instanceof OpenFinanceError ? error.values : undefined);
}
