# 004 — Tela de transações

## Objetivo

Primeira tela real do app: listar, filtrar e criar/editar/excluir
transações — CRUD completo, incluindo divisão por pessoa e transações de
cartão de crédito (parcelamento/fatura).

## Contexto

- Mensagens já prontas em `src/messages/{pt-BR,en}/scrn-transactions.json`
  (namespace `scrn-transactions`): título, cards de resumo, tabela,
  filtros, diálogos, toasts, menu de ações, erros. Faltam alguns campos
  (ver "Mensagens a completar" abaixo).
- Depende de `001-data-model.md` (models `Transaction`, `TransactionSplit`,
  `TransactionCard`, `TransactionInvoice`, `Invoice`, `Card`,
  `CreditCardDetails`) e `003-app-shell.md` (rota `/transactions` já existe
  como placeholder).
- Padrões já disponíveis pra reusar: `useZodForm`/`form.AppField` (TanStack
  Form, `src/lib/form/`), `FormError`, TanStack Table ainda não usado em
  lugar nenhum do projeto — essa é a primeira tela a introduzi-lo.

## Escopo desta task

**Dentro do escopo** (baseado na decisão de ir completo, não só o básico):

- Listagem de transações de **todas as contas** do usuário, com filtro
  opcional por conta (`filters.account`), categoria, período, busca por
  descrição, e tabs Todas/Receitas/Despesas.
- Cards de resumo (saldo/receitas/despesas) calculados sobre o conjunto
  filtrado.
- Criar/editar transação:
  - Campos base: conta, categoria, descrição, valor, data, status.
  - **Divisão por pessoa** (`TransactionSplit`): lista opcional de
    pessoa+valor; se vazia, o valor todo fica sem atribuição (100% "Eu" na
    prática, mas sem registro em `TransactionSplit`). Soma dos splits deve
    bater com o valor da transação — validado no client (Zod) e de novo no
    Server Action.
  - **Cartão de crédito** (campos aparecem só quando a conta escolhida é
    `CREDIT_CARD`): qual `Card` físico (se a conta tiver mais de um),
    número de parcelas. Fatura (`Invoice`) é atribuída automaticamente, não
    escolhida pelo usuário (ver "Faturas automáticas" abaixo).
- Excluir com diálogo de confirmação + toast.
- Menu de ações por linha: editar, duplicar, excluir. **"Arquivar" fica de
  fora** — ver "Fora do escopo".

**Fora do escopo** (mesmo na versão "completa"):

- **Recorrência**: `Recurrence` ainda não gera `Transaction` automaticamente
  (é trabalho futuro, conforme já documentado no `schema.prisma`). Criar
  regras de recorrência é uma tela própria (conta, categoria, frequência,
  início/fim) que não se encaixa no diálogo de uma transação avulsa — vira
  task separada depois de 004/005.
- **Transferências**: dois lançamentos ligados por `transferGroupId`,
  envolvendo duas contas — não é um CRUD de "uma transação", é um fluxo
  diferente. Fica pra uma task própria.
- **Importar/Exportar**: botões já existem no JSON de mensagens mas ficam
  desabilitados/ocultos por enquanto (decisão explícita — ver histórico da
  conversa).
- **"Arquivar"**: o `menu.archive` existe no JSON, mas `TransactionStatus`
  (`PENDING`/`COMPLETED`/`FAILED`) não tem um estado equivalente a
  "arquivada" — arquivar mudaria o schema (novo enum value ou campo
  `archivedAt`). Como isso é uma decisão de modelo de dados, não de tela,
  precisa voltar pro `001-data-model.md` primeiro. Pra essa task, o item
  de menu "Arquivar" fica **oculto** até essa decisão ser tomada
  separadamente.

## Faturas automáticas (cartão de crédito)

Quando a transação é de uma conta `CREDIT_CARD`, a `Invoice` correta
(baseada na data da transação) é resolvida no Server Action, não escolhida
na UI:

1. Buscar uma `Invoice` existente da conta cuja `closingDate` seja a
   próxima após a data da transação (ciclo ainda "aberto" pra essa data).
2. Se não existir (ainda não foi gerada nenhuma fatura pra esse ciclo),
   criar uma nova `Invoice` com `closingDate`/`dueDate` calculadas a partir
   de `CreditCardDetails.closingDay`/`dueDay` (o dia esperado do mês) e
   status `OPEN`.
3. Parcelamento (`installmentCount > 1`): cria uma `Transaction` por
   parcela (`installmentGroupId` compartilhado, `installmentNumber`
   sequencial), cada uma com valor `total / count` e vinculada à fatura do
   mês correspondente (repete o passo 1–2 avançando um ciclo por parcela).

## Mensagens a completar

`scrn-transactions.json` (pt-BR/en) não tem `fields.description` nem
`fields.account`, e não tem nada pra splits/parcelamento/cartão. Adicionar
antes de implementar:

- `fields.description`, `fields.account`
- `fields.person` / seção pra splits (label, botão adicionar/remover)
- `fields.card`, `fields.installments`
- `dialog.create`/`dialog.edit` já existem e servem tanto pra transação
  simples quanto de cartão (mesmo diálogo, campos condicionais).

## Passos

1. Completar mensagens faltantes (pt-BR + en), seguindo o padrão do
   `AGENTS.md`.
2. Zod schemas (`src/app/[locale]/(app)/transactions/schema.ts`):
   `transactionSchema` base + validação condicional de splits (soma =
   valor) e campos de cartão (obrigatórios só se a conta for
   `CREDIT_CARD`).
3. Server Actions (`src/app/[locale]/(app)/transactions/actions.ts`):
   `listTransactions` (filtros), `createTransaction`, `updateTransaction`,
   `deleteTransaction` — todas via Prisma, validadas com os schemas acima,
   escopadas ao `userId` da sessão (`auth.getSession()`). Lógica de fatura
   automática mora aqui.
4. Client: `useQuery` (TanStack Query) pra listar; `useTranslations`
   (`scrn-transactions` + `common`) pra todo texto.
5. Tabela com TanStack Table (primeira vez no projeto — componente
   genérico reaproveitável deve nascer aqui, ex.
   `src/components/data-table/`) + shadcn; estado vazio usa `table.empty`.
6. Filtros (`filters.*`) e cards de resumo (`cards.*`) no topo.
7. Diálogo de criar/editar com `useZodForm` + `form.AppField`, campos
   condicionais de splits/cartão aparecendo/somem conforme a conta
   selecionada.
8. Excluir: `dialog.delete` + toast (`toast.deleted`).
9. Menu de ações por linha (`menu.*`, sem "Arquivar" — ver escopo).

## Pronto quando

- CRUD completo de transação (incluindo splits e cartão/parcelamento)
  funcionando nas duas locales.
- Nenhuma string de UI hardcoded — tudo vem de `scrn-transactions` ou
  `common`.
- `pnpm lint`/`pnpm build` sem erros.

## Status

**Implementado.** Todos os arquivos dos "Passos" acima foram criados:

- `schema.ts`, `actions.ts`, `types.ts`, `columns.tsx`, `data-table.tsx`
  (novo, genérico, em `src/components/data-table/`), `summary-cards.tsx`,
  `filters-bar.tsx`, `transaction-form.tsx`, `transaction-dialog.tsx`,
  `delete-dialog.tsx`, `transactions-view.tsx`, `page.tsx`.
- Mensagens completadas em `scrn-transactions.json` (pt-BR + en).
- Nenhuma dependência nova instalada — `@tanstack/react-table`,
  `date-fns` e `zod` já estavam no `package.json`.

Limitação conhecida: `updateTransaction` (v1) atualiza apenas campos base,
categoria e splits — não recalcula parcelas/fatura se a conta, valor ou
número de parcelas mudar num edit (fluxo de edição de cartão fica pra uma
iteração futura, se for necessário).

Falta rodar localmente pra confirmar: `pnpm lint`, `pnpm build`, e teste
manual do fluxo completo (criar simples, criar parcelado, duplicar,
editar, excluir, filtros, splits) nas duas locales — não foi possível
validar isso a partir do sandbox.
