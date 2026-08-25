import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getInvoiceDetail, getPayableAccounts } from "../actions";
import { InvoiceDetailView } from "./_components/invoice-detail-view";

type InvoiceDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { id } = await params;
  const [invoice, accounts] = await Promise.all([
    getInvoiceDetail(id),
    getPayableAccounts(),
  ]);

  if (!invoice) {
    const t = await getTranslations("scrn-invoices");
    return (
      <div className="mx-auto flex max-w-350 flex-col items-center gap-3 py-16 text-center">
        <h1 className="text-lg font-semibold">{t("detail.notFound.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("detail.notFound.description")}
        </p>
        <Button asChild size="sm">
          <Link href="/invoices">{t("detail.notFound.button")}</Link>
        </Button>
      </div>
    );
  }

  return <InvoiceDetailView invoice={invoice} accounts={accounts} />;
}
