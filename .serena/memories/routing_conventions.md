# Route/File Layout Conventions

Every screen lives at `src/app/[locale]/(app)/<feature>/`. Strict rule (treated
as a bug to fix, not style, per AGENTS.md):

- `page.tsx` / `layout.tsx` hold ONLY the page/layout component. The only flat
  files at a route root are those plus `actions.ts` (Server Actions, `"use
  server"`, every export must be async). Everything else pulled out of the page
  goes into a private `_`-prefixed folder (Next.js excludes `_folder` from
  routing):
  - `_components/` (route-only; shared components go in `src/components`)
  - `_schema/schema.ts` — Zod schemas + form-value helpers
  - `_types/types.ts` — shared types, often `Awaited<ReturnType<typeof
    someAction>>` inferred from `actions.ts`
  - `_lib/` — pure helpers that can't live in `actions.ts` or `schema.ts`
  - `_hooks/use-*.ts` — route-specific hooks, INCLUDING all TanStack Query
    usage (`useQueryClient`, `useMutation`, query-key builders) — a
    screen/component must never call `useQueryClient()`/`invalidateQueries`
    directly, only through a dedicated hook. Same "declarative only" rule
    applies to helper/computation functions in general: a `_components/*.tsx`
    file only composes imports, it doesn't define local helpers/types.
  - `_constants/constants.ts`

- A nested dynamic route (e.g. `people/[id]/`) is its own route segment and
  gets its own `_components/_lib/_types` etc., but its Server Actions are
  added to the PARENT route's `actions.ts`, not a separate `[id]/actions.ts`
  — established precedent: `invoices/actions.ts` has both `listInvoices` and
  `getInvoiceDetail`/`markInvoicePaid` (used by `invoices/[id]/page.tsx`).
  Same pattern followed for `people/actions.ts` (`getPersonStatement` added
  there for `people/[id]/page.tsx`). Types/pure helpers needed by BOTH the
  parent actions.ts and a child route's view should live at the parent's
  `_lib`/`_types` level (not the child's), since the parent can't reach into
  a child route's private folder.

- One older route (`auth/sign-up/`) predates this convention and is left as
  flat files intentionally — don't use it as a template for new routes.

- Breakpoint overrides on Radix-based primitives (`SheetContent`,
  `DrawerContent`) must repeat the primitive's own `data-[...]` attribute
  selector (e.g. `data-[side=right]:sm:max-w-xl`), not a bare
  `sm:max-w-xl` — the primitive's own higher-specificity rule otherwise wins
  silently.

- Never hand-write an arbitrary Tailwind pixel value when a canonical class
  already produces it (v4's spacing scale is linear 0.25rem/4px steps,
  uncapped — `max-w-[1400px]` is `max-w-350`, etc). Exceptions: `calc()`,
  CSS custom properties, keywords, off-scale font sizes, `ring-[3px]`
  (ring scale skips 3), and deliberate non-standard breakpoints.
