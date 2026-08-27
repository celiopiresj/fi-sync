# fi-sync

Personal finance app — multi-user, each user only sees their own data
(accounts, transactions, categories, budgets, investments). Transfers
between accounts are modeled as two linked transactions instead of a
separate type. Built to work well on desktop, laptop, tablet, and phone.

## Features

- **Transactions** — income/expense tracking with categories, expense
  splitting between people, credit card installments, and recurring
  transactions.
- **Accounts** — checking, savings, cash, credit card, and investment
  accounts, each with their own balance/history.
- **Credit cards & invoices** — cards, statements/invoices, due dates, and
  payments.
- **Categories** — system-seeded starter set (expense/income/investment)
  plus user-created categories with custom icon and color.
- **Budgets** — monthly budgets per category, grouped, with over/under
  alerts.
- **Investments** — investment accounts and movements (contributions,
  withdrawals, returns).
- **Projections** — monthly cash-flow projections based on recurring
  transactions and budgets.
- **People** — track who a shared expense belongs to.
- Email/password and Google sign-in (Neon Auth), with a mandatory
  onboarding step for new users and a full password-recovery flow.
- Portuguese (pt-BR) and English, fully localized.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
shadcn/ui · Prisma ORM 7 on Neon Postgres · Neon Auth (Managed Better
Auth) · next-intl · TanStack Query/DB/Table/Form · dinero.js · date-fns.

See [AGENTS.md](./AGENTS.md) for the full stack rationale and the
project's coding conventions (money/date handling, i18n message
structure, form patterns, etc.) — read it before making changes.

## Getting started

```bash
pnpm install
cp .env.example .env   # fill in DATABASE_URL and DIRECT_URL from Neon,
                        # plus the NEON_AUTH_* variables
pnpm prisma generate    # generates the Prisma client into src/generated/prisma
pnpm prisma migrate dev # apply migrations to your database
pnpm dev                # start the dev server on http://localhost:3000
```

Optional: seed some demo data.

```bash
pnpm prisma db seed
```

## Commands

```bash
pnpm dev      # start dev server (localhost:3000)
pnpm build    # production build
pnpm start    # run production build
pnpm lint     # eslint
```

```bash
pnpm prisma migrate dev   # create + apply a migration
pnpm prisma generate      # regenerate client (run after every schema change)
pnpm prisma studio        # inspect data
pnpm prisma db seed       # run the seed script
```

## Project structure

Everything app-related lives under `src/` (Next.js `src` directory
convention). Routes are grouped under `src/app/[locale]/`:

- `(app)/` — the authenticated app, one folder per screen (accounts,
  transactions, budgets, cards, invoices, categories, people, recurrences,
  investments, projections, home).
- `auth/` — sign-in, sign-up, forgot/reset password, OAuth callback.
- `onboarding/` — mandatory first-account setup for new users.

Each screen route follows a private-folder layout
(`_components/`, `_schema/`, `_lib/`, `_hooks/`, `_types/`) documented in
AGENTS.md. Messages live in `src/messages/{locale}/`, one JSON file per
screen plus a shared `common.json`.

## Planning notes

`tasks/` holds the sequenced build-out notes for each feature — see
[tasks/README.md](./tasks/README.md).
