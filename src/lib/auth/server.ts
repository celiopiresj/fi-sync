import { createNeonAuth } from "@neondatabase/auth/next/server";

// Server-side auth instance: .handler() for the API route, .middleware()
// for src/proxy.ts, .getSession() everywhere else (Server Components,
// Server Actions, Route Handlers).
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
  },
});
