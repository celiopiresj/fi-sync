import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getLoanDetail, getLoanFormOptions } from "../actions";
import { LoanDetailView } from "./_components/loan-detail-view";

type LoanDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LoanDetailPage({ params }: LoanDetailPageProps) {
  const { id } = await params;
  const [loan, options] = await Promise.all([
    getLoanDetail(id),
    getLoanFormOptions(),
  ]);

  if (!loan) {
    const t = await getTranslations("scrn-loans");
    return (
      <div className="mx-auto flex max-w-350 flex-col items-center gap-3 py-16 text-center">
        <h1 className="text-lg font-semibold">{t("detail.notFound.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("detail.notFound.description")}
        </p>
        <Button asChild size="sm">
          <Link href="/loans">{t("detail.notFound.button")}</Link>
        </Button>
      </div>
    );
  }

  return <LoanDetailView loan={loan} accounts={options.accounts} />;
}
