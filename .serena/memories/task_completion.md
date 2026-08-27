# Task Completion Checklist

Before reporting a coding task done in this repo:

1. `pnpm lint` — must be clean for any file you touched. As of this writing
   there are 4 pre-existing `@typescript-eslint/no-explicit-any` errors in
   `scripts/import-account-sync.ts`, unrelated to app code — do not treat
   those as yours to fix unless the task is specifically about that script.
2. `pnpm build` for any non-trivial change — runs the TypeScript check too.
   Expect noisy `DYNAMIC_SERVER_USAGE`/cookie-related console output during
   prerender for auth-gated routes; this is normal, not a failure (only the
   final route table + exit status matter).
3. No test suite exists yet — nothing to run there.
4. UI/frontend changes: the app requires a logged-in session (Neon Auth), so
   an unauthenticated `curl`/headless check of an `(app)` route will just
   redirect to `/auth/sign-in`. Say explicitly when a change couldn't be
   visually verified for this reason, rather than claiming it was.
5. Do not commit/push unless explicitly asked (project rule, not just general
   practice).
6. Keep changes scoped to what was asked — no drive-by refactors of unrelated
   files, per AGENTS.md's explicit "Agent workflow rules" section.
