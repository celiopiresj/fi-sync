import type { ReactNode } from "react";
import { getLocale } from "next-intl/server";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/nav/app-sidebar";
import { AccountMenu } from "@/components/nav/account-menu";
import { MobileNavShell } from "@/components/nav/mobile-nav-shell";
import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";

// Onboarding is mandatory — every screen under (app) requires at least one
// Account to exist. proxy.ts already guarantees an authenticated session
// reaches this layout (unauthenticated requests are redirected to sign-in
// before this ever renders), so `session` here should always be present;
// the `?.` is defensive rather than an expected path. /onboarding itself
// lives outside this route group (see its own directory), so it never
// loops back through this check.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;

  if (userId) {
    const hasAccount = await prisma.account.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!hasAccount) {
      const locale = await getLocale();
      redirect({ href: "/onboarding", locale });
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Desktop only. On a phone this bar held nothing but the account
            avatar (its SidebarTrigger is already `md:inline-flex`), and it
            sat directly above each screen's own header — two stacked bars
            for one screen. Its three functions are reachable on mobile
            from the "Mais" tab (theme, language, sign out, see
            more/_components/more-view.tsx) on every route, and the home
            additionally hangs this same menu off its own avatar. */}
        <header className="hidden h-10 items-center gap-2 border-b border-border px-2 md:flex">
          <SidebarTrigger className="hidden md:inline-flex" />
          {/* Single account entry point, top-right — theme, language and
              sign out all live in here now (see AccountMenu's own
              comment) instead of three separate sidebar footer rows. */}
          <div className="ml-auto">
            <AccountMenu />
          </div>
        </header>
        <div className="flex-1 p-4 pb-24 md:pb-4">{children}</div>
      </SidebarInset>
      <MobileNavShell />
    </SidebarProvider>
  );
}
