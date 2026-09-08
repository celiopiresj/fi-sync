import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getAccountDetail } from "../actions";
import { AccountDetailView } from "./_components/account-detail-view";

type AccountDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AccountDetailPage({
  params,
}: AccountDetailPageProps) {
  const { id } = await params;
  const account = await getAccountDetail(id);

  if (!account) {
    const t = await getTranslations("scrn-accounts");
    return (
      <div className="mx-auto flex max-w-350 flex-col items-center gap-3 py-16 text-center">
        <h1 className="text-lg font-semibold">{t("detail.notFound.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("detail.notFound.description")}
        </p>
        <Button asChild size="sm">
          <Link href="/accounts">{t("detail.notFound.button")}</Link>
        </Button>
      </div>
    );
  }

  return <AccountDetailView account={account} />;
}
