# Tech Stack

- Next.js 16.2 (App Router, `src/app/`), React 19.2, TypeScript 5 `strict: true`.
- Frontend + backend in one app: Server Actions / Route Handlers, no separate API.
- Tailwind CSS v4 (no separate CSS-in-JS system). shadcn/ui components in
  `src/components/ui` (style `new-york`), built on Radix UI.
- Prisma ORM 7 + `@prisma/adapter-neon` (Neon serverless Postgres, WebSocket
  driver via `ws`). Client generates to `src/generated/prisma` (gitignored,
  custom path, not `node_modules`). `prisma.config.ts` points migrations at
  `DIRECT_URL` (non-pooled); runtime uses pooled `DATABASE_URL`.
- Neon Auth ("Managed Better Auth") — users/sessions live in the database's
  `neon_auth` schema, not managed by this repo's Prisma migrations. `public.User`
  only holds app-specific profile fields, id matches the Neon Auth user id.
- Zod 4 — validation. next-intl 4 — i18n. TanStack Query/DB/Table/Form — all
  server-state, reactive collections, tables, forms respectively.
- date-fns + date-fns-tz — see `mem:domain_conventions` for the
  APP_TIME_ZONE-pinning rule, this is not generic date-fns usage.
- dinero.js v2 — money arithmetic (not raw `number` math) — see
  `mem:domain_conventions`.
- pnpm (workspace repo — always `pnpm`, never `npm`/`yarn`).
- No test runner configured yet.
