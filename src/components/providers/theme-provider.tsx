"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

// Thin re-export so the rest of the app imports from our own
// `components/providers`, same as `QueryProvider`, instead of reaching
// into `next-themes` directly at every call site.
//
// `next-themes` injects an inline <script> (SSR-only) that sets the
// theme class on <html> before hydration, to avoid a flash of the wrong
// theme. React 19 + Next.js 16.2 warn ("Encountered a script tag...")
// whenever that script re-renders on the client, even though it's a
// false positive — the script already did its job during the initial
// HTML parse and doesn't need to run again. Forcing `scriptProps.type`
// to a non-executable type only on the client (never on the server,
// where the real executable script must still be emitted as-is) quiets
// the warning without touching SSR behavior — a known workaround, see
// https://github.com/pacocoursey/next-themes/issues/387.
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  const scriptProps =
    typeof window === "undefined"
      ? undefined
      : ({ type: "application/json" } as const);

  return (
    <NextThemesProvider scriptProps={scriptProps} {...props}>
      {children}
    </NextThemesProvider>
  );
}
