"use client";

import { authClient } from "@/lib/auth/client";

type Props = {
  label: string;
};

// Kicks off the OAuth redirect flow. Lands back on /auth/callback, which
// finishes syncing the user row and redirects into the app — see
// src/app/[locale]/auth/callback/page.tsx.
export function GoogleSignInButton({ label }: Props) {
  return (
    <button
      type="button"
      onClick={() =>
        authClient.signIn.social({
          provider: "google",
          callbackURL: "/auth/callback",
        })
      }
      className="flex h-11 w-full items-center justify-center rounded-md border border-black/10 px-4 text-sm font-medium hover:bg-black/[.03] dark:border-white/15 dark:hover:bg-white/[.06]"
    >
      {label}
    </button>
  );
}
