import { auth } from "@/lib/auth/server";

// Catch-all proxy for every Neon Auth API call (sign in/up, OAuth
// callbacks, session, email verification, password reset). Deliberately
// outside src/app/[locale]/ — this is an API endpoint, not a localized page.
export const { GET, POST } = auth.handler();
