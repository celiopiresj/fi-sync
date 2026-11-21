import { getTranslations } from "next-intl/server";
import { BankIcon } from "@phosphor-icons/react/dist/ssr";
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
      <div className="mx-auto flex max-w-350 flex-col py-12">
        <Empty className="border-none">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BankIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("detail.notFound.title")}</EmptyTitle>
            <EmptyDescription>{t("detail.notFound.description")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild className="h-11 sm:h-9">
              <Link href="/accounts">{t("detail.notFound.button")}</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  return <AccountDetailView account={account} />;
}
