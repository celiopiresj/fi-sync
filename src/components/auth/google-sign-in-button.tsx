"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { AuthLoadingScreen } from "./auth-loading-screen";

type Props = {
  label: string;
};

// Official Google "G" mark (fixed brand colors, not a theme token — same
// reasoning as a category's user-chosen icon color: this is a fixed brand
// mark, not a status/meaning color covered by the semantic tokens).
function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34A21.93 21.93 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

// Kicks off the OAuth redirect flow. Lands back on /auth/callback, which
// finishes syncing the user row and redirects into the app — see
// src/app/[locale]/auth/callback/page.tsx.
export function GoogleSignInButton({ label }: Props) {
  const t = useTranslations("common.auth");
  // Stays true on success — the page is about to navigate away to
  // Google, so the overlay should remain until it does. Only an error
  // (no redirect happened) brings the button back.
  const [isRedirecting, setIsRedirecting] = useState(false);

  async function handleClick() {
    setIsRedirecting(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/auth/callback",
      });
      if (result?.error) setIsRedirecting(false);
    } catch {
      setIsRedirecting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full"
        disabled={isRedirecting}
        onClick={handleClick}
      >
        <GoogleGlyph />
        {label}
      </Button>
      {isRedirecting && <AuthLoadingScreen label={t("googleRedirecting")} />}
    </>
  );
}
