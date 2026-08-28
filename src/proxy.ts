import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { auth } from "./lib/auth/server";

const intlMiddleware = createIntlMiddleware(routing);
const authMiddleware = auth.middleware({ loginUrl: "/auth/sign-in" });

// Deliberately excludes /auth/callback: Neon Auth's `authMiddleware` must
// actually run on that route to exchange the `neon_auth_session_verifier`
// query param (set when returning from a Google/OAuth redirect) for the
// real session cookie — that exchange happens inside authMiddleware
// itself (see @neondatabase/auth's SKIP_ROUTES/processAuthMiddleware),
// not in the page. Bypassing authMiddleware for /auth/callback the same
// way as the other auth pages meant the verifier was never exchanged, so
// auth.getSession() on that page always saw no session and Google sign-in
// silently bounced back to /auth/sign-in. The other auth pages still need
// this bypass since Neon Auth's own skip-routes list is locale-agnostic
// (e.g. "/auth/sign-in") and never matches our locale-prefixed paths
// (e.g. "/pt-BR/auth/sign-in").
const PUBLIC_PATH = new RegExp(
  `^/(?:(?:${routing.locales.join("|")})/)?auth/(?:sign-in|sign-up|forgot-password|reset-password)(?:/|$)`,
);

export default async function proxy(request: NextRequest) {
  if (request.headers.has("Next-Action")) {
    return;
  }

  const isPublic = PUBLIC_PATH.test(request.nextUrl.pathname);
  let authResult: Awaited<ReturnType<typeof authMiddleware>> | undefined;

  if (!isPublic) {
    authResult = await authMiddleware(request);
    if (authResult && authResult.status >= 300 && authResult.status < 400) {
      return authResult;
    }
  }

  const response = intlMiddleware(request);

  authResult?.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });

  return response;
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
