import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { redirect } from "@/i18n/navigation";
import { isOpenFinanceOwner } from "@/lib/open-finance/access";

export async function requireOpenFinanceOwner(): Promise<string> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    redirect({ href: "/auth/sign-in", locale: await getLocale() });
  }
  if (!userId || !isOpenFinanceOwner(userId)) notFound();
  return userId;
}
