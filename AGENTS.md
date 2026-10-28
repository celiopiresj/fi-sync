# fi-sync

## Product

Personal finance app — multi-user, each user only sees their own data
(accounts, transactions, categories). Categories are partly system-seeded
and partly user-created. Transfers between accounts are modeled as two
linked transactions (one outgoing, one incoming), not a separate type.
Must work well on desktop, laptop, tablet, and phone — responsive, not a
desktop-only tool with a mobile afterthought. Still early: the codebase
has scaffolding (Next.js, Prisma, next-intl, TanStack, shadcn all wired
up) but no data model or screens yet — see `tasks/` for the build
sequence. Update this section as real functionality lands.

## Stack

- Next.js 16 (App Router, `src/app/`) — used for both frontend and backend
  (Route Handlers / Server Actions; no separate API server).
- React 19
- TypeScript, `strict: true`
- Tailwind CSS v4
- shadcn/ui — component source lives in the repo (`src/components/ui`), built
  on Radix UI primitives. `components.json` is set up (style `new-york`,
  aliases pointing at `src/`); add components with
  `pnpm dlx shadcn@latest add <component>`.
- Prisma ORM 7, PostgreSQL hosted on **Neon** (serverless Postgres). Prisma 7
  requires a driver adapter — this uses `@prisma/adapter-neon` +
  `@neondatabase/serverless` (WebSocket driver, needs the `ws` package on
  Node.js), wired up in `src/lib/prisma.ts`. Client generates to a custom
  path (`src/generated/prisma`, gitignored) instead of `node_modules` —
  import it via `@/generated/prisma/client`, not `@prisma/client`.
  Two env vars, both required (see `.env.example`): `DATABASE_URL` is the
  **pooled** Neon connection string (hostname has `-pooler`), used by
  Prisma Client at runtime; `DIRECT_URL` is the non-pooled one, used by the
  Prisma CLI (`prisma.config.ts` points there — migrations must run against
  the direct connection, not the pooler).
- **Neon Auth** ("Managed Better Auth") — authentication, managed by Neon,
  built on Better Auth. Users/sessions live in the `neon_auth` schema of
  the same Postgres database (not managed by our Prisma migrations). Email
  + password, plus Google OAuth. See `tasks/002-auth.md`. `public.User`
  (our own Prisma model) does **not** duplicate the email — its `id`
  matches the Neon Auth user id, and it only holds app-specific profile
  fields; fetch email/name via `auth.getSession()` when needed.
- Zod — input/schema validation (Server Actions, Route Handlers, forms)
- next-intl — internationalization (see "Internationalization (i18n)" below
  for the message file convention)
- TanStack Query — server-state fetching/caching on the client
- TanStack DB — reactive client-side collections/live queries on top of
  TanStack Query (joins/filters across entities like transactions, accounts,
  categories without refetching); adopt incrementally, collection by collection
- TanStack Table — data tables (transaction lists, statements, etc.)
- TanStack Form — forms
- date-fns — date parsing/formatting/arithmetic. See the "Date values"
  convention below for the specific parsing/math rule that avoids a
  UTC/local timezone mismatch.
- date-fns-tz — IANA timezone support for date-fns (`toZonedTime`/
  `fromZonedTime`), used to pin date-only values to `APP_TIME_ZONE`
  regardless of the server's own runtime timezone. See `src/lib/date.ts`
  and the "Date values" convention below.
- dinero.js (v2) — safe monetary arithmetic in application code (sign
  flips, split/installment totals, comparisons) instead of plain `number`
  math. See the "Money values" convention below.
- pnpm (workspace repo — use `pnpm`, not `npm`/`yarn`)
- ESLint (`eslint-config-next`)

## Commands

First-time setup:
```bash
pnpm install
cp .env.example .env   # then fill in DATABASE_URL and DIRECT_URL from Neon
pnpm prisma generate    # generates the client into src/generated/prisma
```

```bash
pnpm dev      # start dev server (localhost:3000)
pnpm build    # production build
pnpm start    # run production build
pnpm lint     # eslint
```

There is no test runner configured yet. If you add one, document the command
here.

Focused Open Finance checks (no live bank data or database writes):
```bash
pnpm exec tsx scripts/check-open-finance.ts
```
Database integration check (synthetic fixtures in an always-rolled-back
transaction; requires the configured Neon database):
```bash
pnpm exec tsx scripts/check-open-finance-database.ts
```

Prisma (schema has no models yet — add them to `prisma/schema.prisma` first):
```bash
pnpm prisma migrate dev   # create + apply a migration
pnpm prisma generate      # regenerate client (run after every schema change)
pnpm prisma studio        # inspect data
pnpm prisma db seed       # run the seed script (not automatic in Prisma 7)
```

shadcn/ui:
```bash
pnpm dlx shadcn@latest add <component>   # e.g. button, dialog, input, table
```

## Conventions

- **Open Finance is restricted to the project owner's fi-sync user.**
  Other users must not see or use bank connections or synchronization.
  Enforce the restriction on the server using an explicitly configured
  authenticated user id, not only by hiding UI; deny access when that
  configuration is missing. Imported data belongs only to that user.
  The personal Meu Pluggy integration lives at `/open-finance`; its
  setup and import behavior are documented in `docs/open-finance.md`.
  Import receipts survive deleting a local transaction, so fetching
  again does not silently recreate a deliberately deleted entry.
  Connect through the official MeuPluggy widget (connector 200), capturing
  item ids automatically. Verify `clientUserId` against the owner and
  connector metadata with the provider before accepting widget/webhook
  results. Webhooks must authenticate before reading their payload and
  must never reactivate a connection the user disabled.
  A Pluggy connection `onError` must keep the widget mounted so its own
  error/retry screen and diagnostics remain available. Only initial
  `onLoadError`, explicit close or successful completion may unmount it.
  Display translated messages and sanitized provider error codes; never
  echo arbitrary SDK messages, tokens, credentials or request URLs.
- Everything app-related lives under `src/` (`src/app`, `src/components`,
  `src/lib`, etc.) — that's the Next.js `src` directory convention. Only
  `public/` (static assets) stays at the repo root, per Next.js requirements.
- Use the `@/*` path alias (maps to `./src/*`) instead of relative `../../` imports.
- Prefer Server Components by default; add `"use client"` only when a component
  needs interactivity, state, or browser APIs.
- **`page.tsx`/`layout.tsx` files hold only the page/layout component** —
  nothing else. The only flat files at a route's root are `page.tsx` /
  `layout.tsx` and its Server Actions (`actions.ts`) — everything else
  pulled out of the page always goes into a co-located **private folder**
  (Next.js's `_folderName` convention: underscore-prefixed folders are
  excluded from routing, so they can never collide with a real route
  segment), never a bare file sitting next to `page.tsx`. Standard names,
  used consistently:
  - `_components/` — components used only by this route (shared ones
    still go in `src/components`). Once there are enough to group by
    responsibility, split into subfolders inside it, e.g.
    `_components/table/`, `_components/form/`.
  - `_schema/schema.ts` — Zod schemas and form-value helpers for the route.
  - `_types/types.ts` — shared types for the route (e.g. types derived
    from `actions.ts`'s return values).
  - `_lib/` — pure helper/formatting functions that can't live in
    `actions.ts` (which is `"use server"` — every export from it must be
    an async function) or that don't belong in `schema.ts`. Broadly
    reusable helpers still go in `src/lib/utils`.
  - `_hooks/use-*.ts` — hooks truly specific to the route (broadly
    reusable ones still go in `src/hooks`), including any TanStack Query
    usage (`useQueryClient`, `useMutation`, query-key builders) — see the
    dedicated rule below.
  - Constants specific to the route go in `_constants/constants.ts` the
    same way.

  See `src/app/[locale]/(app)/transactions/` for this pattern in full.
  `src/app/[locale]/auth/sign-up/` predates this convention (just
  `page.tsx` + `actions.ts` + a flat `schema.ts`) — leave it as-is unless
  you're already touching it, but any new route, or any route gaining a
  second supporting file, follows the private-folder layout above.
- **Screens and components stay declarative — no inline services, helper
  functions, or types.** A `_components/*.tsx` file (or `page.tsx`) only
  composes JSX from things it imports; it never defines locally what
  belongs somewhere else: helper/formatting/computation functions go in
  `_lib/` (route-specific) or `src/lib/` (shared), types go in
  `_types/types.ts` (or a shared types file), and server-side logic goes
  in `actions.ts`. This applies in full to **TanStack Query** — every
  `useQueryClient()`, `invalidateQueries`, `useQuery`, `useMutation`, and
  query-key array must live inside a dedicated hook (`_hooks/use-*.ts` for
  a route, `src/hooks/` if shared across routes), never called directly in
  a screen or component body. A component calls `useTransactionMutations()`
  (or similar) — it doesn't call `useQueryClient()` and `invalidateQueries`
  itself. Same enforcement as the form-field-primitive rule below: this is
  a bug to fix, not a style preference, including in existing code you
  happen to be touching for something else.
- **Every screen requires a logged-in user.** No session → redirect to
  `/auth/sign-in` (the only public pages are sign-in/sign-up/forgot/reset
  password). `proxy.ts` enforces this, and each layout/page that reads the
  session repeats it as a page-level guard instead of silently rendering
  with no user. `/onboarding` is for users who are logged in but have no
  financial `Account` yet: no session → sign-in, already has an `Account`
  → `/`. The `(app)` layout sends account-less users to `/onboarding`.
- **A card purchase stops being PENDING once its date arrives.**
  `completePastPendingCardPurchases` (`src/lib/complete-past-purchases.ts`)
  flips every credit-card transaction with `status: PENDING` and
  `date <= today` to COMPLETED — run from the `(app)` layout and
  `listTransactions`. Debit accounts are deliberately excluded (a
  past-dated pending bill may really be unpaid). Any new screen that
  shows card purchases' status should rely on this, not re-derive it.
- **Changing a transaction's account or date must move its invoice
  link.** `TransactionInvoice` is written at creation; any edit that
  rewrites `accountId`/`date` in place calls `relinkTransactionInvoices`
  (`src/lib/invoice-relink.ts`) for the rows that actually changed.
- Keep styling in Tailwind utility classes; avoid introducing a second styling
  system (CSS-in-JS, separate CSS modules) unless there's a specific need.
- **A breakpoint override on a Radix-based primitive (Sheet, Drawer, and
  similar) must repeat that primitive's own `data-[...]` attribute
  selector, not just the bare breakpoint.** `SheetContent` (and
  `DrawerContent`) cap their width internally with rules like
  `data-[side=right]:sm:max-w-sm` — that compiles to a selector with
  higher specificity than a plain `sm:max-w-xl` passed in from a caller's
  `className`, so the plain version is silently ignored and the sheet
  stays at the primitive's own default width no matter what override you
  pass. Always match the same attribute prefix instead:
  `data-[side=right]:sm:max-w-xl` (see any `*-sheet.tsx` under
  `_components/form/` for the pattern, keyed off whichever `side` value
  that sheet actually uses). This is a bug to fix, not a style
  preference, wherever a `SheetContent`/`DrawerContent` `className` sets
  a breakpoint-prefixed size utility without the matching `data-[...]:`.
  Matching the prefix is necessary but **not sufficient**: the override
  also has to be a value `tailwind-merge` recognizes as conflicting, or
  both classes survive into the DOM at equal specificity and the winner
  is decided by whichever rule Tailwind happened to emit last. The known
  trap is `max-h-none`, which `cn()` does *not* dedupe against
  `max-h-[80vh]` — verified against the real strings, along with
  `max-h-full`/`max-h-screen`/`max-h-dvh`, which all do dedupe and
  actually drop the cap. So to uncap a bottom drawer, use
  `data-[vaul-drawer-direction=bottom]:max-h-dvh`, never `max-h-none`
  (see `add-transaction-drawer.tsx`). When an override looks correct but
  doesn't take, check the merged class string before assuming
  specificity is the cause.
- **Never hand-write an arbitrary pixel value in a Tailwind class when a
  canonical class already produces that exact value — always use the
  canonical one.** Tailwind v4's spacing scale (`w-*`, `h-*`, `size-*`,
  `max-w-*`, `min-w-*`, `gap-*`, `p-*`, `m-*`, `inset-*`, `translate-*`,
  …) is linear in 0.25rem/4px steps and uncapped, so any 4px-aligned
  pixel value already has a bare-number class — `max-w-[1400px]` is
  `max-w-350` (1400 ÷ 4), `w-[220px]` is `w-55`, `w-[28px]` is `w-7`, and
  so on (fractional multiples like `size-[26px]` → `size-6.5` work too).
  Border radius has its own small named scale (`rounded-xs` = 2px,
  `rounded-sm` = 4px, `rounded-md` = 6px, `rounded-lg` = 8px, …) — check
  that before reaching for `rounded-[Npx]`. This is about picking the
  class that already exists, not about banning arbitrary values
  outright: some values genuinely have no canonical equivalent (a
  `calc(...)` expression, a CSS custom property like `w-(--sidebar-width)`,
  a keyword like `rounded-[inherit]`, a font-size off the fixed
  `text-xs`/`sm`/`base`/… scale, or `ring-[3px]` — Tailwind's ring-width
  scale is a fixed small set that skips 3) — those stay as arbitrary
  values because there's nothing canonical to swap in. A custom
  responsive cutoff that doesn't line up with `sm`/`md`/`lg`/`xl` (e.g.
  the transactions/recurrences/invoices tables' `min-[700px]:`
  desktop-table/mobile-list breakpoint, deliberately narrower than `md`
  at 768px — see the comment at that class) is the same kind of
  legitimate exception: it's a breakpoint choice, not a sizing value, and
  no named breakpoint fits it.
- Data access goes through Prisma; the shared client instance lives in
  `src/lib/prisma.ts` (import `{ prisma }` from there, never instantiate
  `PrismaClient` elsewhere). It already wires up the Neon driver adapter
  and reuses the instance across dev hot-reloads.
- Validate all external input (Server Action args, Route Handler bodies, form
  submissions) with Zod schemas before touching Prisma — don't trust
  client-supplied data. Co-locate schemas near the action/handler that uses
  them, or in a shared `src/lib/schemas` if reused.
- Server Actions / Route Handlers own writes and DB access; client components
  use TanStack Query to call them and manage server-state cache — don't
  reinvent caching with `useState`/`useEffect` for server data.
- For screens that need to join/filter across multiple entities on the client
  (e.g. transactions by account + category), wrap the relevant TanStack Query
  collections with TanStack DB and use live queries instead of manual
  `.filter()`/`useMemo()` composition.
- Use TanStack Table for any tabular/list UI (transactions, statements) and
  TanStack Form for forms, rather than ad-hoc implementations.
- UI components come from shadcn/ui (`src/components/ui`, added via `pnpm dlx
  shadcn@latest add <component>`). These are owned code, not a package —
  edit them directly rather than wrapping/overriding from outside. Don't mix
  in another component/class library (e.g. DaisyUI) alongside it.
- **Form field components (`src/components/form/*-field.tsx`, registered on
  `useAppForm`) must render through the matching `src/components/ui/*`
  primitive** (`TextField`/`DateField` → `Input`, `SelectField` → `Select`,
  etc.) instead of a hand-rolled `<input>`/element with its own one-off
  classes. This is what keeps every control's height, padding, border
  token, and focus/invalid states consistent across field types (e.g. a
  `Select` and the `Input` next to it in the same form must always be the
  same size) — a field wrapper that skips the shared primitive is a bug,
  not a style choice.
- Money values: `Decimal` (`@db.Decimal(12, 2)` in Prisma), never `Float` —
  exact arithmetic, no manual cents conversion. Sign convention: positive =
  income, negative = expense; a transfer's two legs are one negative
  (source account) + one positive (destination account) row sharing a
  `transferGroupId`. For arithmetic on money in application code — sign
  flips, summing split amounts, dividing an installment total, comparing
  two amounts, anything beyond storing/reading a single value — use
  **dinero.js** rather than plain `number` math with `+`/`-`/`*`/`/`, which
  is prone to floating-point rounding error. dinero.js's `allocate` in
  particular fits splitting a total across N parts (installments, person
  splits) without losing the remainder cents. Convert to/from `Decimal`
  only at the Prisma read/write boundary.
- Date values: every date-only value (transaction date, invoice
  closing/due date, recurrence/installment occurrences) is pinned to a
  fixed `APP_TIME_ZONE` ("America/Sao_Paulo", `src/lib/date.ts`) rather
  than relying on "local time" — the app is server-rendered and may run
  its Server Actions on a host whose own runtime timezone (UTC on most
  serverless platforms) has nothing to do with where Neon or the users
  are, so "local" isn't a consistent reference frame across parsing, math,
  and display. Concretely:
  - Parse every date-only string (e.g. from `<input type="date">`, or a
    filter param) with **`parseCalendarDate`** from `src/lib/date.ts`,
    never the native `new Date("YYYY-MM-DD")` constructor — the native
    constructor reads a date-only string as UTC midnight, which is the
    wrong calendar day as soon as anything downstream reads it back in a
    different timezone.
  - Any date-fns arithmetic (`setDate`/`addDays`/`addWeeks`/`addMonths`)
    on one of these values must run on `toAppZoned(date)` and convert the
    result back with `fromAppZoned` before storing/returning it (see
    `computeInvoiceCycle` in `_lib/invoice-cycle.ts` and `stepDate` in
    `actions.ts` for the pattern) — plain date-fns math reads/writes the
    server process's own timezone, not `APP_TIME_ZONE`.
  - Display formatting gets `timeZone: APP_TIME_ZONE` for free from the
    global next-intl config (`src/i18n/request.ts`) — `useFormatter()`
    already resolves through it, so don't pass a one-off `timeZone` at
    the call site.
  - This combination (native `new Date()` parsing + unzoned date-fns math
    + unpinned `Intl` display) was a real, verified bug: the transaction
    date column and `computeInvoiceCycle` — a purchase near the card's
    closing day could resolve into the wrong invoice — were both off by a
    day in any timezone behind UTC. If a new screen or feature introduces
    another date-only value, follow this same pattern rather than reaching
    for `new Date()` directly.
- **Status/money colors use the app's semantic tokens, never raw Tailwind
  palette classes.** `globals.css` defines `--positive`/`--negative`/
  `--warning` (plus `--surface-1`) specifically for "money in" / "money
  out" / "attention tier" coloring — income vs. expense, within-budget vs.
  over-budget, paid vs. pending, and similar. Use `text-positive`/
  `text-negative`/`text-warning` (and their `bg-*/10` translucent forms,
  same pattern as `bg-destructive/10`) for that — never `text-emerald-600`,
  `bg-rose-100`, `text-amber-600`, etc. This was a real, verified drift:
  the `categories` and `people` (list) screens, and several `budgets`
  components, independently reinvented emerald/rose/amber for the exact
  same "positive/negative/warning" concept the tokens already cover,
  producing a slightly different green/red per screen. `KpiCard`
  (`src/components/screen/kpi-card.tsx`) takes a `tone` prop
  (`"default"|"positive"|"negative"|"warning"`) that maps to these tokens
  automatically — reach for it instead of hand-picking a color. This
  doesn't apply to genuinely decorative/arbitrary color (e.g. a user's
  chosen category icon color from the color picker, or a chart's
  categorical palette) — only to conveying income/expense/status meaning.
- **Reuse the shared screen components instead of re-implementing them
  per route.** `src/components/screen/` holds the app-wide building
  blocks every list screen needs: `PageHeader`/`PeriodStepper` (title +
  subtitle + optional period stepper), `KpiCard`/`KpiGrid` (the stat-card
  row at the top of a screen), `SearchInput` (search box with icon +
  clear button), `ViewModeToggle` (the cards/list segmented control).
  These exist because every route used to hand-roll a slightly different
  version of the same thing (different card radius, different search box
  height, different empty-state markup) — before adding a new one-off
  version of any of these, check whether the shared component already
  covers it. Similarly, always use the shared `Empty`/`EmptyHeader`/
  `EmptyMedia`/`EmptyTitle`/`EmptyDescription`/`EmptyContent` family
  (`src/components/ui/empty.tsx`) for empty states rather than a hand-rolled
  `border-dashed` div, and `Card`'s own `radius="lg"` prop
  (`src/components/ui/card.tsx`) for the bigger-radius item-grid tiles
  (invoice cards, people cards, budget item cards, category cards)
  instead of overriding with `className="rounded-2xl"`.
- **Responsive by default** — every screen must work on desktop, laptop,
  tablet, and phone, not just desktop. Design/test against Tailwind's
  standard breakpoints, not arbitrary widths:
  unprefixed (below 640px, phone portrait — this is the mobile-first
  baseline: plain utility classes with no breakpoint prefix, not a
  `max-sm:` override), `sm` (640px, phone landscape / small tablet), `md`
  (768px, tablet portrait), `lg` (1024px, tablet landscape / small
  laptop), `xl` (1280px, laptop / desktop). Tailwind is mobile-first: base
  classes (no prefix) target the smallest phones first, then
  `sm:`/`md:`/`lg:`/`xl:` override upward as the screen grows — never
  fixed pixel widths that only make sense on one device class. The app
  shell already handles the main
  split: `useIsMobile` (`src/hooks/use-mobile.ts`) switches at 768px (the
  `md` breakpoint) — below that, the sidebar
  (`src/components/nav/app-sidebar.tsx`) becomes an off-canvas `Sheet`;
  at/above it, it's the fixed desktop sidebar. New screens should reuse
  `sm`/`md`/`lg`/`xl` consistently (e.g. a table that becomes cards below
  `md`) instead of introducing their own breakpoints.
- **Form fields always stack, never side by side** — every field in a form
  (create/edit sheets, dialogs, etc.) is full-width, one per row, at every
  breakpoint — no `sm:grid-cols-2`/`lg:grid-cols-2` pairing of fields into
  a row, even on wide screens. Use `flex flex-col gap-4` (or similar),
  never a multi-column grid, for a form's field layout. This doesn't apply
  to non-field content laid out in columns (e.g. the 3-up summary cards on
  the transactions screen) — just form inputs.
- **Consistent Screen Container Width** — all main screens and detail views must
  use `mx-auto flex max-w-350 flex-col gap-6` as their outermost container to
  ensure a consistent maximum width (1400px) across the entire application.
- **No hardcoded UI text, anywhere, ever — and no "default" text either.**
  Every user-facing string comes from a `useTranslations`/`getTranslations`
  call against `scrn-*`/`common` messages, full stop. This includes: text
  that looks like a fallback (`label ?? "Amount"`), a default prop value
  that's a literal string (`submittingLabel = "Loading..."`), placeholder
  copy left in while prototyping, `aria-label`s, empty-state copy, and
  error messages. If a component needs a piece of text and no message key
  exists for it yet, add the key to the relevant `scrn-*.json` (or
  `common.json` if shared) in both `pt-BR` and `en` first — don't inline
  it "temporarily." The only acceptable literal strings in TSX are
  non-visible plumbing that i18n has no business touching: `data-slot`
  values, CSS class names, HTML attribute values like `type="email"`, and
  the like.
- Run `pnpm lint` and `pnpm build` before considering a change done.

## Internationalization (i18n)

Uses next-intl. Messages are split into one JSON file per namespace, per
locale:

```
src/messages/
  pt-BR/
    common.json
    scrn-transactions.json
    scrn-dashboard.json
    scrn-accounts.json
  en/
    common.json
    scrn-transactions.json
    ...
```

**This is the standard pattern for every screen's messages. Always follow it.
If a new screen, entity, or message type doesn't fit cleanly, extend the
pattern consistently (new category, same shape as the existing ones) rather
than inventing a different structure. If truly unsure how something should
fit, ask instead of guessing.**

Rules:

- One file per screen: `scrn-{screen}.json` (e.g. `scrn-transactions.json`).
  The `scrn-` prefix carries through to the namespace key used in code too
  (`useTranslations('scrn-transactions')`) — don't drop it there. Without it,
  a bare namespace like `'transactions'` reads ambiguously next to a data
  model or API resource of the same name; `scrn-` makes it unambiguous at the
  call site that this is a screen's messages, not something else.
- `common.json` holds anything reused across more than one screen: generic
  buttons (save/cancel/edit/delete), generic `status` values (active,
  inactive, pending, completed, failed, loading), and `validation` messages
  (required, invalid, min, max, minLength, maxLength, email) reused by Zod
  form errors. A screen only defines its own `status`/local messages for
  values that don't exist in `common`.
- Inside a file, do **not** prefix keys with their type — rely on the parent
  object for context (`buttons.add`, not `buttons.button-add`). The one
  exception is the `scrn-` namespace prefix described above.
- Within a screen file, use these top-level categories as they apply (skip
  ones the screen doesn't need, don't invent alternate names for them):
  `title` / `subtitle` / `description`, `breadcrumb`, `buttons`, `cards`,
  `chart`, `fields`, `table` (`columns`, `empty`, `selection`, plus row
  `menu`), `filters`, `dialog` (confirm/create/edit — always
  `title`/`description`/`confirm`/`cancel`), `toast`, `tabs`, `pagination`,
  `tooltip`, `aria`, `errors` (`title` + `description` per error).
- Always `description`, singular — never `descriptions`.
- Counts use ICU `plural` (e.g. `"{count, plural, =0 {...} one {...} other
  {...}}"`), never manual string concatenation with a number.
- Interpolation variable names must be alphanumeric + underscore only (ICU
  constraint) — e.g. `{from}`, `{total}`, not `{from-date}`.
- Locale-prefixed routing is set up: every URL is under `/pt-BR/...` or
  `/en/...`. This means:
  - `src/i18n/routing.ts` — `defineRouting({ locales, defaultLocale })`, the
    single source of truth for supported locales.
  - `src/proxy.ts` — the locale-detection proxy (named `proxy.ts`, not
    `middleware.ts`, per the Next.js 16 rename), built from `routing`.
  - `src/i18n/navigation.ts` — use `Link`/`redirect`/`useRouter`/`usePathname`
    from here instead of `next/link` / `next/navigation`, so links keep the
    current locale automatically.
  - Pages/layouts live under `src/app/[locale]/...`.
- `src/i18n/request.ts` loads every `.json` file under `src/messages/{locale}/`
  **dynamically** — namespace = filename without extension. Adding a new
  `scrn-*.json` (or `common.json`-style file) under a locale folder is
  automatically picked up; nothing in `request.ts` needs to change. It also
  validates the incoming `[locale]` param against `routing.locales` and falls
  back to `routing.defaultLocale`. Every locale folder (`pt-BR/`, `en/`, ...)
  must contain the exact same set of filenames — a missing file for a locale
  means that whole namespace is unavailable there. It runs in the Node.js
  runtime (`fs` is used), so don't move it to an Edge runtime.

```tsx
const t = useTranslations('scrn-transactions');
t('buttons.add.title');
```

- Money amounts are never stored as translated strings — format them at
  runtime with `useFormatter().number()` (or Prisma Decimal → Intl), keeping
  currency formatting separate from message content.

## Agent workflow rules

- When the user states something during a session that reads as a standing
  rule or convention (not a one-off request specific to that moment), add
  it to this file as a new/updated convention instead of only applying it
  in place — don't wait to be told "put this in AGENTS.md" each time. If
  it's ambiguous whether something is a one-off or a standing rule, ask.
- Don't commit or push without being asked explicitly.
- Run `pnpm lint` (and `pnpm build` for non-trivial changes) before reporting
  a task as finished; fix errors, don't just report them.
- Keep changes scoped to what was asked — no drive-by refactors or unrelated
  file changes in the same edit.
- If a dependency needs to be added or upgraded, **ask first and wait for
  the go-ahead** — don't add it to `package.json` and move on. Say which
  package/version and why, then pause. (Note: the whole TanStack suite,
  Zod, date-fns, etc. are already declared in `package.json` from earlier
  setup — reaching for those isn't "adding a dependency," this rule is
  about anything not already there.)
- Ask before introducing new architectural patterns (state management library,
  database/ORM, auth provider, etc.) since none are established yet.
- Always follow the message file convention in "Internationalization (i18n)"
  for any new screen or translated string. Don't create a one-off structure
  for a specific case — extend the existing categories/shape, and ask if
  something genuinely doesn't fit.
- **Always add translation keys to the JSON files FIRST** before adding them
  to a component. Never leave a `t("key")` call in code without ensuring the
  corresponding key exists in both `pt-BR` and `en` JSON files, as this causes
  hard crashes in development when the key is missing.
