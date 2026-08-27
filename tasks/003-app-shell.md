# 003 — Layout base e navegação

## Objetivo

Criar a casca visual do app: navegação principal, seletor de idioma, e o
container que toda tela vai usar — antes de construir telas de conteúdo.

## Contexto

- `src/app/[locale]/layout.tsx` já existe (root layout com
  `NextIntlClientProvider` + `QueryProvider`), mas não tem navegação nenhuma.
- Rotas com prefixo de locale já funcionam (`src/i18n/routing.ts`,
  `src/proxy.ts`, `src/i18n/navigation.ts`).
- shadcn configurado (`components.json`) mas nenhum componente instalado
  ainda — precisa rodar `pnpm dlx shadcn@latest add <componente>` localmente.
- Todo o app fora de `/auth/*` já é protegido pelo `proxy.ts` (task 002) —
  o shell só precisa se preocupar com layout, não com auth.

## Decidido

- **Layout: sidebar** fixa à esquerda (desktop). Usar o componente
  dedicado `Sidebar` do shadcn (`SidebarProvider`, `Sidebar`,
  `SidebarMenu`...) em vez de montar isso na mão — ele já resolve mobile
  internamente (usa `Sheet` como off-canvas por baixo dos panos), então não
  precisamos compor `Sheet` manualmente.
- **Itens do menu** (nesta ordem): Início, Transações, Pessoas, Faturas,
  Contas, Recorrências, Cartões.
  - Nenhuma dessas telas existe ainda de verdade (dashboard é a task 005,
    transações a 004, o resto ainda nem tem task própria). Pra sidebar não
    linkar pra 404, cada rota ganha uma página placeholder simples (título
    + "em construção") nesta task; o conteúdo real substitui o placeholder
    quando a tela for implementada na sua própria task.
  - Slugs de rota em inglês, por consistência com `/auth/sign-in`,
    `/auth/sign-up` já existentes: `/`, `/transactions`, `/people`,
    `/invoices`, `/accounts`, `/recurrences`, `/cards`. Labels do menu vêm
    do i18n (ver abaixo), então o texto exibido é em pt-BR/en normalmente.
- Menu do usuário (dropdown, canto da sidebar): mostra sessão atual (via
  `authClient.useSession()`) e botão de sign-out (`authClient.signOut()`).

## Passos

1. Componentes shadcn necessários pra essa task: `sidebar` (já traz `sheet`
   junto, usado internamente pra mobile), `button`, `separator`, `avatar` —
   **já estavam instalados** em `src/components/ui/`. Só faltava
   `dropdown-menu` (seletor de idioma / menu de usuário) — like o registry
   do shadcn (`ui.shadcn.com`) não é alcançável de dentro do sandbox
   (bloqueado pelo proxy de rede), escrevi `dropdown-menu.tsx` à mão
   seguindo exatamente os padrões dos componentes já instalados (`select.tsx`,
   `popover.tsx`: pacote unificado `radix-ui`, ícones `@phosphor-icons/react`,
   `data-slot`, animações `data-open`/`data-closed`, `rounded-lg`/`ring-1
   ring-foreground/10`/`text-xs`). Recomendo rodar `pnpm dlx shadcn@latest
   diff dropdown-menu` localmente pra comparar com a versão oficial do
   registry e ajustar se houver diferença.
   - Outros componentes já instalados no projeto (`badge`, `card`, `table`,
     `field`, `input`, etc.) são pra tasks futuras (004+), não usados aqui.
2. Criar `src/components/nav/app-sidebar.tsx` usando
   `Sidebar`/`SidebarHeader`/`SidebarContent`/`SidebarMenu`/`SidebarFooter`
   do shadcn, envolvido por `SidebarProvider` no layout. Usar `Link` de
   `@/i18n/navigation`, não `next/link`, pra manter o locale na URL. Item
   ativo via `SidebarMenuButton isActive` com base em `usePathname()`.
3. Seletor de idioma: `dropdown-menu` usando `usePathname`/`useRouter` de
   `@/i18n/navigation` pra trocar entre `pt-BR`/`en` mantendo a rota atual.
4. Menu de usuário: `dropdown-menu` com e-mail da sessão
   (`authClient.useSession()`) e ação de sign-out.
5. Namespace de mensagens `common.json` (`pt-BR`/`en`) com seção `nav`
   (`nav.home`, `nav.transactions`, `nav.people`, `nav.invoices`,
   `nav.accounts`, `nav.recurrences`, `nav.cards`) e seção pro seletor de
   idioma/menu de usuário (`userMenu.signOut`, etc.) — seguir as categorias
   já definidas no `AGENTS.md`.
6. Criar as 7 páginas placeholder — cada uma com título + texto "em
   construção" via i18n.
7. **Composição do shell: route group `(app)`.** Todas as 7 páginas vivem
   em `src/app/[locale]/(app)/{route}/page.tsx`, com um único
   `src/app/[locale]/(app)/layout.tsx` aplicando `SidebarProvider` +
   `AppSidebar` + `SidebarInset` pra tudo dentro do grupo. `auth/` fica
   fora do grupo (sibling), então continua com só o layout raiz simples,
   sem sidebar. (Uma versão anterior tinha usado um `AppShell` client-side
   decidindo por `usePathname()`, contornando uma limitação temporária do
   sandbox pra mover/apagar arquivos — já migrado pro route group, que é
   a forma idiomática do Next.js pra isso.)

## Status

Implementado:

- `src/components/nav/nav-items.ts` — lista dos 7 itens (rota, ícone,
  chave de tradução).
- `src/components/nav/app-sidebar.tsx`, `language-switcher.tsx`,
  `user-menu.tsx`.
- `src/app/[locale]/(app)/layout.tsx` — shell (sidebar + trigger mobile),
  aplicado só às rotas do grupo.
- `src/app/[locale]/(app)/page.tsx` (início) + 6 páginas
  (`transactions`, `people`, `invoices`, `accounts`, `recurrences`,
  `cards`), todas usando `src/components/placeholder-screen.tsx` (Server
  Component, `getTranslations`).
- `common.json` (pt-BR/en): seções `nav`, `userMenu`, `language`,
  `placeholder`.
- `src/components/ui/dropdown-menu.tsx` criado (inicialmente à mão, depois
  ajustado — ver histórico).

Não testado localmente ainda — falta validar visualmente: sidebar/mobile
sheet, troca de idioma, sign-out, e rodar `pnpm lint`/`pnpm build`.

## Pronto quando

- Sidebar visível em todas as rotas exceto `/auth/*`, com os 7 itens
  navegando entre si (mesmo que pra placeholders). **(pendente de teste)**
- Menu mobile (Sheet) funciona em telas estreitas. **(pendente de teste)**
- Trocar idioma no seletor mantém a página atual, só muda o prefixo da URL.
  **(pendente de teste)**
- Menu de usuário mostra o e-mail da sessão e sign-out funciona (volta pra
  `/auth/sign-in`). **(pendente de teste)**
