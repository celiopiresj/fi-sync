# 001 — Modelo de dados

## Objetivo

Desenhar e migrar o schema do Prisma (`prisma/schema.prisma`, hoje vazio)
com as entidades centrais do app.

## Contexto

- Banco: **Neon** (Postgres serverless). Prisma 7 com `@prisma/adapter-neon`,
  já configurado em `src/lib/prisma.ts` e `prisma/seed.ts`.
- Precisa de duas connection strings do Neon no `.env` (ver `.env.example`):
  `DATABASE_URL` (pooled, hostname com `-pooler`, usada em runtime) e
  `DIRECT_URL` (direta, usada pelo CLI/migrations via `prisma.config.ts`).
  Pegue as duas no dashboard do Neon → Connect.
- Valores monetários: `Decimal` (`@db.Decimal(12, 2)`) — decidido, ver
  `AGENTS.md`. Sinal do valor indica receita (+) ou despesa (-).

## Status: schema completo, falta migrar

`prisma/schema.prisma` e `prisma/seed.ts` já têm tudo abaixo implementado.
Falta rodar a migration — isso precisa ser feito na sua máquina, não
consigo rodar `prisma migrate` a partir daqui.

## Decisões já tomadas

- **Multi-usuário**: cada `User` só vê os próprios dados. `Bank`, `Account`,
  `Person`, `Category` (as criadas por usuário), `Transaction` e
  `Recurrence` têm `userId`.
- **Hierarquia banco → conta**: um usuário pode ter vários `Bank`
  (instituição — Nubank, Itaú...); cada banco pode ter várias `Account`
  (corrente, poupança, investimento, caixinha, cartão de crédito). `CASH`
  (dinheiro) não pertence a banco nenhum (`bankId` nulo).
- **Tipos de conta**: `CHECKING`, `SAVINGS`, `INVESTMENT`, `POCKET`
  (caixinha), `CREDIT_CARD`, `CASH`.
- **Categorias**: existem categorias fixas do sistema (seed, `userId` nulo)
  e categorias que o usuário cria (`userId` preenchido). Uma tela de
  gerenciar categorias entra no roadmap (depois de
  `004-transactions-screen.md`).
- **Pessoas / divisão de saldo**: `Person` é um rótulo que o usuário cria
  (Eu, Mãe, Irmão, Amigos...). Uma `Transaction` pode ser **dividida** entre
  várias pessoas via `TransactionSplit` (não é uma pessoa só por
  transação) — a soma dos splits deve bater com o valor da transação
  (validado na aplicação, não no banco).
- **Recorrência**: `Recurrence` guarda só a regra (frequência
  diária/semanal/mensal, data de início, data de fim opcional — nula = sem
  fim). **Não gera transações automaticamente ainda** — isso é uma task
  futura (precisa de job agendado). `Transaction.recurrenceId` já existe
  pra quando a geração for implementada.
- **Transferências**: modeladas como duas transações ligadas (uma saída na
  conta origem, uma entrada na conta destino), conectadas por um
  `transferGroupId` — não é um novo `type` isolado.
- **Cartão de crédito** — mesmo "fim" que as outras contas: uma compra é
  uma `Transaction` normal (categoria, split entre pessoas, recorrência
  reaproveitados como estão). O que é específico de cartão:
  - `CreditCardDetails` (1:1 com `Account`, só quando `type = CREDIT_CARD`):
    limite, e `closingDay`/`dueDay` como **padrão esperado** de
    fechamento/vencimento (dia do mês) — não é a fonte da verdade de um
    período específico, só usado pra sugerir a próxima fatura.
  - `Card` (N:1 com `Account`): uma conta de cartão pode ter vários
    cartões físicos (titular + adicionais), todos compartilhando o mesmo
    limite/fatura da conta.
  - Qual cartão foi usado numa compra: tabela de ligação separada
    `TransactionCard` (não é coluna em `Transaction` — pedido explícito).
  - **Parcelamento**: `installmentGroupId`/`installmentNumber`/
    `installmentCount` direto na `Transaction`, mesmo espírito do
    `transferGroupId` — uma linha por parcela, cada uma com o valor
    **daquela parcela** (12x de R$100 → 12 transações de -100, não uma
    transação de -1200 com referência às parcelas).
  - `Invoice` (fatura): guarda o fechamento/vencimento **reais** daquele
    período específico (podem variar por fim de semana/feriado — por isso
    não são recalculados a partir do `closingDay` fixo) e o status de
    pagamento (`OPEN`/`CLOSED`/`PAID`, valor pago, data do pagamento).
  - Qual fatura uma transação caiu: tabela de ligação separada
    `TransactionInvoice`, atribuída explicitamente na criação da
    transação (não recalculada depois, pelo mesmo motivo do fechamento
    variável).

## Entidades (implementadas em `prisma/schema.prisma`)

- `User` — dono dos dados.
- `Bank` — instituição financeira (`name`, `color`, `userId`).
- `Account` — conta financeira. `bankId` opcional, `type` (`AccountType`),
  `status` (active/inactive), moeda, `userId`.
- `CreditCardDetails` — limite e dia padrão de fechamento/vencimento,
  1:1 com `Account` (só cartão de crédito).
- `Card` — cartão físico, N:1 com `Account`.
- `Invoice` — fatura de um período específico (fechamento/vencimento reais
  + status de pagamento), N:1 com `Account`.
- `Person` — rótulo de pessoa pra divisão de saldo (`name`, `userId`).
- `Category` — flat, `userId` nulo = sistema, preenchido = do usuário.
- `Transaction` — valor (`Decimal`, sinal indica receita/despesa), data,
  descrição, conta, categoria opcional, `status` (`TransactionStatus`:
  pending/completed/failed), `userId`, `transferGroupId` opcional,
  `installmentGroupId`/`installmentNumber`/`installmentCount` opcionais,
  `recurrenceId` opcional, `splits` (divisão entre pessoas).
- `TransactionSplit` — join table `Transaction` ↔ `Person` com o valor de
  cada parte.
- `TransactionCard` — join table `Transaction` ↔ `Card` (qual cartão físico
  foi usado).
- `TransactionInvoice` — join table `Transaction` ↔ `Invoice` (em qual
  fatura a transação caiu).
- `Recurrence` — regra de recorrência: conta, categoria opcional, valor,
  descrição, `frequency` (`RecurrenceFrequency`: daily/weekly/monthly),
  `startDate`, `endDate` opcional.

`prisma/seed.ts` cria: 1 usuário demo, 1 banco, 4 contas (corrente,
poupança, caixinha, dinheiro) + 1 conta de cartão de crédito com
`CreditCardDetails`, 2 cartões físicos (titular + adicional) e 2 faturas;
3 pessoas; 6 categorias do sistema; transações de exemplo (uma dividida
entre pessoas, uma transferência com as duas pernas linkadas, uma compra no
cartão com `TransactionCard`/`TransactionInvoice`, uma compra parcelada em
2x); e uma recorrência de exemplo. Registrado em `prisma.config.ts`
(`migrations.seed`).

## Passos (rodar na sua máquina)

1. ~~Definir os models em `prisma/schema.prisma`~~ — feito.
2. ~~Escrever `prisma/seed.ts`~~ — feito.
3. Criar um projeto no [Neon](https://neon.tech), copiar as duas connection
   strings (pooled e direta) pro `.env` como `DATABASE_URL`/`DIRECT_URL`.
4. `pnpm install` (se ainda não rodou depois das deps novas — precisa do
   `tsx` pra rodar o seed e do `@prisma/adapter-neon`/`ws`).
5. `pnpm prisma migrate dev --name init`.
6. `pnpm prisma generate`.
7. `pnpm prisma db seed`.

## Pronto quando

- `pnpm prisma migrate dev` roda sem erro.
- `pnpm prisma studio` mostra as tabelas com os dados do seed (incluindo
  cartão, cartões físicos, faturas, parcelamento e split entre pessoas).

## Próximo (fora do escopo desta task)

- Gerenciar categorias (criar/editar/excluir).
- Gerar transações a partir de `Recurrence` automaticamente (job agendado).
- Fechar fatura automaticamente / calcular `paidAmount` a partir das
  transações da fatura.
