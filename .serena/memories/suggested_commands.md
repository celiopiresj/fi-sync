# Suggested Commands

Windows machine; PowerShell is the primary shell here, but a POSIX Bash tool is
also available — pick the syntax matching whichever tool you're invoking through
(don't mix `$env:VAR` with POSIX `$VAR` etc.).

## Core loop
- `pnpm dev` — dev server (localhost:3000)
- `pnpm build` — production build (also runs the TypeScript check)
- `pnpm lint` — eslint (flat config, `eslint-config-next`)
- No test command exists yet.

## First-time setup
```
pnpm install
cp .env.example .env   # fill DATABASE_URL (pooled) + DIRECT_URL (direct) from Neon
pnpm prisma generate    # → src/generated/prisma
```

## Prisma
```
pnpm prisma migrate dev   # create + apply a migration (runs against DIRECT_URL)
pnpm prisma generate      # regenerate client — run after every schema.prisma change
pnpm prisma studio
pnpm prisma db seed        # Prisma 7 doesn't run this automatically
```

## shadcn/ui
```
pnpm dlx shadcn@latest add <component>
```

## Windows-shell gotchas
- Prefer forward slashes / POSIX-style paths in the Bash tool; PowerShell needs
  its own quoting for paths with brackets (`[locale]`, `(app)`) — these route
  segment names are literal directory names in this repo and often need quoting
  in either shell.
- No sandboxed destructive-command differences beyond the usual — nothing
  project-specific beyond matching shell syntax to the tool invoked.
