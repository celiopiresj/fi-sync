import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/server";
import { isOpenFinanceOwner } from "@/lib/open-finance/access";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export async function OpenFinanceLink() {
  const { data: session } = await auth.getSession();
  if (!isOpenFinanceOwner(session?.user?.id)) return null;
  const t = await getTranslations("scrn-open-finance");
  return <Button variant="outline" asChild><Link href="/open-finance">{t("title")}</Link></Button>;
}
