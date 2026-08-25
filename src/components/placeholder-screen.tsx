import { getTranslations } from "next-intl/server";

// Shared body for nav routes that don't have a real screen yet (tasks
// 004+ replace these one at a time). Title comes from `common.json`'s
// `nav.*` so it always matches the sidebar label; the "not built yet"
// copy is shared via `common.json`'s `placeholder.*`. Server Component
// (uses next-intl/server's getTranslations) so the pages that render it
// stay Server Components too — no interactivity needed here.
export async function PlaceholderScreen({
  titleKey,
}: {
  titleKey:
    | "home"
    | "transactions"
    | "people"
    | "invoices"
    | "accounts"
    | "recurrences"
    | "cards";
}) {
  const t = await getTranslations("common");

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-lg font-semibold">{t(`nav.${titleKey}`)}</h1>
      <p className="text-sm text-muted-foreground">
        {t("placeholder.description")}
      </p>
    </div>
  );
}
