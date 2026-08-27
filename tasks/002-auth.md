# 002 — Autenticação (Neon Auth)

## Objetivo

Implementar login usando **Neon Auth** — hoje chamado "Managed Better Auth"
pela Neon: um serviço de auth gerenciado, embutido no próprio projeto Neon,
que guarda usuários/sessões/OAuth no schema `neon_auth` do mesmo banco
Postgres que já usamos (`public`). Construído sobre a lib **Better Auth**.
Ainda em beta.

## Por que isso muda o plano anterior

- Resolve as duas perguntas em aberto de antes: biblioteca (Better Auth,
  gerenciado) e método (e-mail/senha nativo; OAuth como Google já vem com
  credenciais de teste prontas da própria Neon).
- **Não roda em servidor próprio** — é uma API REST gerenciada pela Neon,
  na mesma região do banco. A aplicação só chama o SDK
  (`@neondatabase/auth`).
- Cada branch do Neon tem seu próprio ambiente de auth isolado (útil pra
  preview/CI mais pra frente, não é algo que precisamos configurar agora).

## Impacto no modelo de dados (`prisma/schema.prisma`)

Hoje o model `User` (de `001-data-model.md`) tem `id` gerado por
`@default(cuid())`, `email` e `name` — ou seja, a aplicação é dona da
identidade do usuário. Com Neon Auth, quem cria/autentica o usuário é o
serviço da Neon (tabelas ficam em `neon_auth`, fora do nosso controle via
Prisma). Proposta:

- `User.id` deixa de ter `@default(cuid())` — passa a ser o **mesmo id**
  que o Neon Auth atribui ao usuário (preenchido explicitamente quando
  sincronizamos, não gerado por nós).
- `User.email` — **removido**. Neon Auth já guarda o e-mail em `neon_auth`;
  não duplicamos pra evitar dessincronizar. Quando precisar do e-mail (ex:
  exibir na UI), busca via `auth.getSession()`. `public.User` fica só com
  `id` (= id do Neon Auth) + campos de perfil específicos do app que vierem
  a existir.
- Todo o resto do schema (`Bank`, `Account`, `Person`, `Category`,
  `Transaction`, etc.) continua igual — todos já referenciam `userId`, só
  muda de onde esse id vem.
- Nossa tabela `User` em `public` continua existindo (não some) — serve de
  "ponto de extensão" pra dados de perfil específicos do app (preferências,
  etc.) e mantém as relations do Prisma funcionando como estão, sem precisar
  fazer o Prisma enxergar o schema `neon_auth` diretamente.
- Precisa de um passo de **sincronização**: quando alguém se cadastra via
  Neon Auth, criamos a linha correspondente em `public.User` com o mesmo id
  (ex: no callback depois do `signUp.email()`, ou lazy na primeira request
  autenticada).

## Decidido

- `User.email` não é duplicado em `public.User` (ver acima).
- Login: **e-mail/senha + Google (OAuth)**. O Google já vem com credenciais
  de teste prontas pelo Neon Auth, então não precisa configurar um app
  OAuth próprio agora.
- **App inteiro protegido**: tudo exige login, exceto as próprias telas de
  `/auth/sign-in` e `/auth/sign-up`. A raiz `/` redireciona pro dashboard
  se autenticado, ou pra sign-in se não.
- **Sem verificação de e-mail obrigatória** por enquanto — cadastro já
  libera acesso. Pode virar uma task futura.

## Ponto de atenção pra implementação (não é decisão, é aviso)

`src/proxy.ts` hoje só faz roteamento de locale (next-intl,
`createMiddleware(routing)`). Neon Auth também espera rodar via
`proxy.ts`/`middleware.ts` (`auth.middleware()`) pra proteger rotas. Os
dois precisam compor no mesmo arquivo — não são dois `export default`
separados. Vai exigir escrever a lógica combinada (rodar auth check e
locale routing em sequência) na hora de implementar o passo 7 abaixo.

## Passos

1. No Neon Console: projeto → branch → **Auth** → Enable Auth. Copiar a
   Auth URL.
2. `pnpm add @neondatabase/auth@latest`.
3. No Neon Console, habilitar Google como provedor de sign-in (credenciais
   de teste já inclusas).
4. `.env`: `NEON_AUTH_BASE_URL` (a Auth URL) e `NEON_AUTH_COOKIE_SECRET`
   (gerar com `openssl rand -base64 32`). Adicionar ao `.env.example` com
   placeholder.
5. `src/lib/auth/server.ts` — instância `auth` via `createNeonAuth()`.
6. `src/lib/auth/client.ts` — `authClient` via `createAuthClient()`, pros
   componentes client.
7. `src/app/api/auth/[...path]/route.ts` — `export const { GET, POST } =
   auth.handler();`
8. Compor `src/proxy.ts`: hoje só `createMiddleware(routing)` do next-intl;
   precisa rodar a checagem de auth (`auth.middleware()`) também, sem
   quebrar o roteamento de locale. Como o app inteiro é protegido, a regra
   fica simples: `/{locale}/auth/*` é público, todo o resto exige sessão.
   Páginas ficam em `src/app/[locale]/auth/sign-in`,
   `src/app/[locale]/auth/sign-up` (públicas) — o resto de
   `src/app/[locale]/...` é protegido por padrão.
9. Telas de login/cadastro como novos namespaces `scrn-sign-in` e
   `scrn-sign-up` em `src/messages/` (seguir o padrão do `AGENTS.md`) — nada
   de texto hardcoded, incluindo o botão "Continuar com Google".
10. Ajustar `prisma/schema.prisma`: remover `@default(cuid())` de `User.id`
    e remover o campo `email` (ver "Impacto no modelo de dados").
11. Passo de sincronização: criar `public.User` quando o Neon Auth cria a
    conta (ver "Impacto no modelo de dados").

## Correções aplicadas (vs. doc oficial do Next.js App Router)

Comparando a implementação com o guia oficial
(https://neon.com/guides/neon-auth-nextjs), `src/lib/auth/server.ts` e
`src/lib/auth/client.ts` já usam os imports corretos
(`@neondatabase/auth/next/server` e `@neondatabase/auth/next`) e a API
route já usa `auth.handler()` — não precisam mudar. Duas divergências
reais encontradas:

1. **`.env.example` falta `NEXT_PUBLIC_NEON_AUTH_URL`.** A doc lista essa
   variável como obrigatória para o client-side em Next.js, além de
   `NEON_AUTH_BASE_URL` (server-side). Hoje só temos a segunda. Adicionar
   com o mesmo valor de `NEON_AUTH_BASE_URL` (a Auth URL do Neon Console).

2. **`src/proxy.ts` não pula requests com header `Next-Action`.** O
   exemplo oficial faz isso:
   ```ts
   if (request.headers.has("Next-Action")) {
     return;
   }
   ```
   Server Actions chamadas de dentro de uma rota protegida carregam esse
   header; rodar `auth.middleware()` em cima delas pode interferir na
   action (a autenticação já é validada dentro da própria action via
   `auth.getSession()`). Ajustar `proxy.ts` para checar esse header antes
   de decidir se roda `authMiddleware`, mantendo o resto da lógica atual
   (locale routing + `PUBLIC_PATH` para `/auth/*`) intacto.

## Status

Implementação dos passos 2, 5–11 concluída no código:

- `src/lib/auth/server.ts`, `src/lib/auth/client.ts`, `src/lib/auth/sync-user.ts`
  (`ensureUserSynced`).
- `src/app/api/auth/[...path]/route.ts`.
- `src/proxy.ts` compondo next-intl + `auth.middleware()` (ver "Ponto de
  atenção" acima — ainda não testado de ponta a ponta, comportamento de
  redirect/refresh de cookie é a parte mais arriscada).
- Telas `src/app/[locale]/auth/sign-up/page.tsx` e `.../sign-in/page.tsx`
  (+ `actions.ts` de cada uma), `src/app/[locale]/auth/callback/page.tsx`,
  `src/components/auth/google-sign-in-button.tsx`.
- Mensagens `scrn-sign-in`/`scrn-sign-up` em `pt-BR` e `en`.
- `prisma/schema.prisma` e `prisma/seed.ts` já refletem `User.id` sem
  `@default` e sem `email`.

Passos 1, 3, 4 dependem do Neon Console / ambiente local do usuário (fora
do sandbox) — ver `.env.example` para as chaves esperadas.

## Pronto quando

- `pnpm dev`, cadastro (e-mail/senha e Google) e login funcionando de ponta
  a ponta. **(pendente de teste local)**
- Qualquer rota fora de `/{locale}/auth/*` redireciona pra sign-in quando
  não autenticado; `/` redireciona pro dashboard quando autenticado.
  **(pendente de teste local)**
- Roteamento de locale (`/pt-BR/...`, `/en/...`) continua funcionando nas
  rotas protegidas e nas públicas. **(pendente de teste local)**
- Usuário recém-cadastrado aparece em `public.User` (sincronizado).
  **(pendente de teste local)**
