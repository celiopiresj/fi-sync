import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { auth } from "./lib/auth/server";

const intlMiddleware = createIntlMiddleware(routing);
const authMiddleware = auth.middleware({ loginUrl: "/auth/sign-in" });

const PUBLIC_PATH = new RegExp(
  `^/(?:(?:${routing.locales.join("|")})/)?auth(?:/|$)`,
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
