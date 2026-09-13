import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getPersonStatement } from "../actions";
import { currentStatementPeriod } from "../_lib/cash-cycle";
import { getTransactionFormOptions } from "../../transactions/actions";
import { PersonDetailView } from "./_components/person-detail-view";

type PersonDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PersonDetailPage({ params }: PersonDetailPageProps) {
  const { id } = await params;
  const [statement, transactionFormOptions] = await Promise.all([
    getPersonStatement(id, currentStatementPeriod()),
    // Lets the "Nova transação"/edit flow open right from this page —
    // see PersonDetailView's own comment.
    getTransactionFormOptions(),
  ]);

  if (!statement) {
    const t = await getTranslations("scrn-people");
    return (
      <div className="mx-auto flex max-w-350 flex-col items-center gap-3 py-16 text-center">
        <h1 className="text-lg font-semibold">{t("detail.notFound.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("detail.notFound.description")}
        </p>
        <Button asChild size="sm">
          <Link href="/people">{t("detail.notFound.button")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <PersonDetailView
      personId={id}
      initialStatement={statement}
      transactionAccounts={transactionFormOptions.accounts}
      transactionCategories={transactionFormOptions.categories}
      initialTransactionPeople={transactionFormOptions.people}
      initialDefaultPersonId={transactionFormOptions.defaultPersonId}
      defaultDebitAccountId={transactionFormOptions.defaultDebitAccountId}
      defaultCreditAccountId={transactionFormOptions.defaultCreditAccountId}
    />
  );
}
