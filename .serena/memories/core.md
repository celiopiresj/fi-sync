# fi-sync — Core

Personal finance app, multi-user, Next.js full-stack (no separate API server).
Still early/actively built — see `tasks/*.md` at repo root for the build sequence
and per-feature design decisions (numbered, sequential).

**Canonical conventions doc**: `AGENTS.md` at repo root (also `CLAUDE.md`, which
just `@`-includes it). It is comprehensive and enforced — read it in full before
any non-trivial change; this memory only adds a quick-reference, not a
replacement. Violating AGENTS.md conventions is treated as a bug to fix, not a
style choice (stated explicitly in the doc for several rules).

## Source map

- `prisma/schema.prisma` — single source of truth for the data model; has a long
  top-of-file "Decisions" comment explaining *why* each modeling choice was made
  (transfers as two linked Transaction rows, credit card structure, sign
  convention, etc.) — read it before assuming a shape.
- `src/generated/prisma/` — generated Prisma client (gitignored). Import via
  `@/generated/prisma/client`, never `@prisma/client` directly.
- `src/app/[locale]/(app)/<feature>/` — one folder per screen/route. Each has
  `page.tsx`, `actions.ts` ("use server", serves both the list page and any
  `[id]` sub-route under it), and private `_components/_schema/_types/_lib/_hooks`
  folders. See `mem:routing_conventions` for the exact layout rule.
- `src/messages/{pt-BR,en}/*.json` — i18n message files, one per screen
  (`scrn-*.json`) plus `common.json`. See `mem:i18n_conventions`.
- `src/lib/` — cross-route shared helpers (date.ts, prisma.ts, utils.ts, auth/).
- `src/components/ui/` — shadcn/ui primitives, owned code (edit directly, not a
  package).
- `src/components/form/` — form-field wrappers registered on `useAppForm`
  (TanStack Form), one per field type, each must render through the matching
  `src/components/ui/*` primitive.

## Further memories

- `mem:tech_stack` — full stack + versions.
- `mem:suggested_commands` — dev/build/lint commands, Windows-shell notes.
- `mem:routing_conventions` — the private-folder (`_component`/`_lib`/...) route
  layout rule and when a nested `[id]` route gets its own action vs. reusing the
  parent's `actions.ts`.
- `mem:domain_conventions` — money (Decimal/dinero.js), date (APP_TIME_ZONE)
  and other cross-cutting invariants that are easy to violate silently.
- `mem:i18n_conventions` — message file/key structure rule.
- `mem:task_completion` — what "done" means for a coding task here.
