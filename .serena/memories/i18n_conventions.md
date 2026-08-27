# i18n Message File Conventions

`src/messages/{locale}/*.json`, loaded dynamically by `src/i18n/request.ts`
(namespace = filename minus extension) — adding a new file needs no code
change, but every locale folder must have the exact same set of filenames.

- One file per screen: `scrn-{screen}.json`, namespace used in code keeps the
  `scrn-` prefix (`useTranslations('scrn-transactions')`) — disambiguates from
  a data-model/API resource of the same bare name.
- `common.json` — cross-screen generics only: buttons (save/cancel/edit/
  delete), generic `status` values, `validation` messages for Zod form
  errors. A screen only defines its own copy of these for values `common`
  doesn't have.
- No type-prefixed keys inside a file (`buttons.add`, not
  `buttons.button-add`) — the `scrn-` namespace prefix is the one exception.
- Standard top-level categories, used only as needed, not renamed/invented:
  `title`/`subtitle`/`description`, `breadcrumb`, `buttons`, `cards`, `chart`,
  `fields`, `table` (`columns`,`empty`,`selection`,row `menu`), `filters`,
  `dialog` (`create`/`edit`/`delete`, each with `title`/`description`/
  `confirm`/`cancel`), `toast`, `tabs`, `pagination`, `tooltip`, `aria`,
  `errors` (`title`+`description` per error).
- Always `description` singular, never `descriptions`.
- Counts → ICU `plural`, never manual string concat with a number.
- Interpolation variable names: alphanumeric + underscore only (ICU
  constraint) — `{from}` not `{from-date}`.
- Locale-prefixed routing (`/pt-BR/...`, `/en/...`) — always import
  `Link`/`redirect`/`useRouter`/`usePathname` from `@/i18n/navigation`, never
  `next/link`/`next/navigation` directly, so the locale carries through.
- Money is never a translated string — format at runtime via
  `useFormatter().number(value, {style: "currency", currency: "BRL"})`.
- If a new screen/entity doesn't fit this shape cleanly, the convention is to
  ask rather than invent a new structure.
