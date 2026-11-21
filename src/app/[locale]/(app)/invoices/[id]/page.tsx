import { getTranslations } from "next-intl/server";
import { ReceiptIcon } from "@phosphor-icons/react/dist/ssr";
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
import { getInvoiceDetail, getPayableAccounts } from "../actions";
import { getTransactionFormOptions } from "../../transactions/actions";
import { InvoiceDetailView } from "./_components/invoice-detail-view";

type InvoiceDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { id } = await params;
  const [invoice, accounts, transactionFormOptions] = await Promise.all([
    getInvoiceDetail(id),
    getPayableAccounts(),
    // Only fetched to let a purchase in this invoice be edited in place
    // (reuses transactions' own CreditTransactionSheet/updateCreditTransaction
    // — see invoice-detail-view.tsx's own comment on that dependency).
    getTransactionFormOptions(),
  ]);

  if (!invoice) {
    const t = await getTranslations("scrn-invoices");
    return (
      <div className="mx-auto flex max-w-350 flex-col py-12">
        <Empty className="border-none">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ReceiptIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("detail.notFound.title")}</EmptyTitle>
            <EmptyDescription>{t("detail.notFound.description")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild className="h-11 sm:h-9">
              <Link href="/invoices">{t("detail.notFound.button")}</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  return (
    <InvoiceDetailView
      invoice={invoice}
      accounts={accounts}
      transactionAccounts={transactionFormOptions.accounts}
      categories={transactionFormOptions.categories}
      people={transactionFormOptions.people}
      defaultPersonId={transactionFormOptions.defaultPersonId}
    />
  );
}
