import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getInvestmentAccountDetail, listTransferAccounts } from "../actions";
import { InvestmentAccountDetailView } from "./_components/investment-account-detail-view";

type InvestmentAccountDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function InvestmentAccountDetailPage({
  params,
}: InvestmentAccountDetailPageProps) {
  const { id } = await params;
  const [account, transferAccounts] = await Promise.all([
    getInvestmentAccountDetail(id),
    listTransferAccounts(),
  ]);

  if (!account) {
    const t = await getTranslations("scrn-investments");
    return (
      <div className="mx-auto flex max-w-350 flex-col items-center gap-3 py-16 text-center">
        <h1 className="text-lg font-semibold">{t("detail.notFound.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("detail.notFound.description")}
        </p>
        <Button asChild size="sm">
          <Link href="/investments">{t("detail.notFound.button")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <InvestmentAccountDetailView account={account} transferAccounts={transferAccounts} />
  );
}
