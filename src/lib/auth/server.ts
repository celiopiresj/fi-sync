import { createNeonAuth } from "@neondatabase/auth/next/server";

// Server-side auth instance: .handler() for the API route, .middleware()
// for src/proxy.ts, .getSession() everywhere else (Server Components,
// Server Actions, Route Handlers).
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    // Default "strict" cookies are never sent on a cross-site top-level
    // navigation — which is exactly what a return trip from Google's OAuth
    // consent screen to /auth/callback is. That silently dropped the
    // "session_challange" cookie the OAuth verifier exchange (inside
    // authMiddleware) depends on, so Google sign-in could never complete.
    // "lax" still sends cookies on top-level cross-site navigations.
    sameSite: "lax",
  },
});
