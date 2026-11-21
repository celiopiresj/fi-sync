import { getTranslations } from "next-intl/server";
import { UsersIcon } from "@phosphor-icons/react/dist/ssr";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
      <div className="mx-auto flex max-w-350 flex-col py-12">
        <Empty className="border-none">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("detail.notFound.title")}</EmptyTitle>
            <EmptyDescription>{t("detail.notFound.description")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild className="h-11 sm:h-9">
              <Link href="/people">{t("detail.notFound.button")}</Link>
            </Button>
          </EmptyContent>
        </Empty>
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
