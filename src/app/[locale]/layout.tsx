import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { SerwistProvider } from "@serwist/turbopack/react";
import { routing } from "@/i18n/routing";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fi-sync",
  description: "Finanças pessoais",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fi-sync",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#00a160" },
    { media: "(prefers-color-scheme: dark)", color: "#00c685" },
  ],
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html
      lang={locale}
      // Theme class is set on the client by next-themes before paint, so
      // the server-rendered class always mismatches on first load —
      // suppressHydrationWarning is the documented way to silence that
      // specific, expected warning without disabling hydration checks
      // elsewhere.
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <SerwistProvider swUrl="/serwist/sw.js">
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <NextIntlClientProvider>
              <QueryProvider>
                {children}
                <Toaster />
              </QueryProvider>
            </NextIntlClientProvider>
          </ThemeProvider>
        </SerwistProvider>
      </body>
    </html>
  );
}
