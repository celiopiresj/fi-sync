# 017 — Tela de Empréstimos

## Objetivo

Criar `/loans`, uma tela dedicada pra rastrear empréstimos — tanto
dinheiro que o usuário empresta a alguém (a receber) quanto dinheiro que
o usuário pega emprestado (a pagar) — com cronograma de parcelas de datas
fixas, cada uma virando uma transação real quando paga. Hoje isso não
existe como conceito no banco: aparece só como categoria comum de
transação ("Empréstimo (Despesa)"/"Empréstimo (Recebimento)", ver
`scripts/import-account-sync-data.json`), sem nenhum rastreio de quem
deve quanto ou cronograma.

## Decisões (confirmadas com o usuário)

1. **Duas direções**, no mesmo modelo: `LENT` (emprestei, a receber) e
   `BORROWED` (peguei emprestado, a pagar).
2. **Parcelas com datas fixas**, não um saldo simples abatido por
   pagamentos avulsos — mesma lógica de uma compra parcelada no cartão
   (`installmentNumber`/`installmentCount`, ver `Transaction` em
   `prisma/schema.prisma`), não a lógica de fatura (que aceita qualquer
   valor de pagamento contra um total).
3. **Sempre ligado a uma `Person`** já cadastrada — reaproveita o modelo
   existente (`src/app/[locale]/(app)/people/`), não aceita uma
   instituição/texto livre.
4. **Cada parcela paga gera uma `Transaction` real**, debitando/
   creditando uma `Account` de verdade — mesmo princípio de
   `payInvoice` (`invoices/actions.ts`), que já faz exatamente isso pro
   pagamento de fatura.
5. **Dia de vencimento configurável**, separado da data de início — o
   usuário define um dia do mês (1–31) em que as parcelas vencem, do
   jeito que um cartão de crédito tem `closingDay`/`dueDay` distintos
   (`CreditCardDetails` em `prisma/schema.prisma`). A 1ª parcela não
   precisa vencer no mesmo dia em que o empréstimo foi registrado — ex:
   emprestei no dia 3, mas combinei de receber sempre no dia 10.

## Contexto

- **Rota:** `src/app/[locale]/(app)/loans/` (nova — checar se já existe
  um placeholder no sidebar/nav; se não, adicionar `nav.loans` em
  `common.json` de ambos os locales, mesmo padrão de `nav.cards`/
  `nav.invoices`).
- **Já implementado, reaproveitar sem duplicar:**
  - `Person` (`prisma/schema.prisma`) — a pessoa do outro lado do
    empréstimo. `Person.isSelf` não se aplica aqui (o empréstimo nunca é
    "comigo mesmo").
  - Padrão `Invoice`/`InvoicePayment`/`recomputeInvoiceStatus`
    (`src/lib/invoice-total.ts`, `invoices/actions.ts`) — mesma ideia
    geral de "entidade com status derivado de pagamentos vinculados, não
    persistido diretamente", só que aqui por PARCELA em vez de por total.
  - `AmountField`/`PickerRowField`/`DatePickerRowField`
    (`src/components/form/`) — mesmos primitivos de formulário já usados
    em `cards`/`transactions`.
  - dinero.js pra dividir `totalAmount` em N parcelas sem perder
    centavos de resto (mesmo padrão do parcelamento de cartão —
    `installmentAmountMode`/`resolveSplitsCreateInput` em
    `transactions/actions.ts`).
  - `src/lib/date.ts` (`parseCalendarDate`/`toAppZoned`/`fromAppZoned`/
    `setDateClamped` de `invoice-resolution.ts`) — mesmo cuidado de fuso
    horário pra calcular a data de cada parcela mensal a partir de
    `startDate`.

## Modelo de dados proposto (Prisma)

```prisma
enum LoanDirection {
  LENT      // eu emprestei — a receber
  BORROWED  // eu peguei emprestado — a pagar
}

enum LoanInstallmentStatus {
  PENDING
  PAID
}

model Loan {
  id          String        @id @default(cuid())
  userId      String
  user        User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  personId    String
  person      Person        @relation(fields: [personId], references: [id], onDelete: Restrict)
  direction   LoanDirection
  description String
  // Sempre uma magnitude positiva — `direction` é o que determina se
  // cada parcela paga vira uma transação positiva ou negativa, mesma
  // separação "sinal só na Transaction" que o resto do app já segue.
  totalAmount Decimal       @db.Decimal(12, 2)
  startDate   DateTime      @db.Date
  // Dia do mês (1–31) em que cada parcela vence — independente do dia
  // de `startDate`, mesma separação closingDay/dueDay de
  // `CreditCardDetails`. A 1ª parcela usa o primeiro `dueDay` a partir
  // de `startDate` (mesmo cálculo "empurra pro próximo mês se já
  // passou" de `computeInvoiceCycle`, `src/lib/invoice-resolution.ts`),
  // as seguintes avançam um mês por parcela.
  dueDay      Int
  createdAt   DateTime      @default(now()) @db.Timestamptz(3)

  installments LoanInstallment[]

  @@index([userId])
  @@index([personId])
}

model LoanInstallment {
  id                String                 @id @default(cuid())
  loanId            String
  loan              Loan                   @relation(fields: [loanId], references: [id], onDelete: Cascade)
  installmentNumber Int
  installmentCount  Int
  dueDate           DateTime               @db.Date
  amount            Decimal                @db.Decimal(12, 2)
  status            LoanInstallmentStatus  @default(PENDING)
  // Criada só no momento em que a parcela é marcada como paga — não há
  // pré-criação de N transações no ato de cadastrar o empréstimo (ao
  // contrário do parcelamento de cartão), já que um empréstimo pode
  // atrasar/renegociar antes de cada parcela realmente acontecer.
  transactionId     String?                @unique
  transaction       Transaction?           @relation(fields: [transactionId], references: [id], onDelete: SetNull)

  @@unique([loanId, installmentNumber])
  @@index([loanId])
}
```

`Person`/`User`/`Transaction` ganham a relação inversa correspondente
(`loans Loan[]`, `loanInstallments LoanInstallment[]`).

## Regras de Negócio

- **Criação:** usuário informa pessoa, direção, descrição, valor total,
  quantidade de parcelas, data de início (`startDate`) e dia de
  vencimento (`dueDay`, 1–31). O total é dividido em N parcelas mensais
  iguais (dinero.js `allocate`, resto absorvido pela 1ª parcela — mesmo
  critério já usado em outros splits do app). Datas calculadas a partir
  de `dueDay`, não do dia de `startDate`: a 1ª parcela vence no primeiro
  `dueDay` que seja `>= startDate` (empurra pro mês seguinte se
  `dueDay` já passou dentro do mês de `startDate`), as seguintes
  avançam um mês por parcela (clampado pelo tamanho do mês, mesmo
  `setDateClamped` de `invoice-resolution.ts`).
- **Status da parcela:** `PENDING` até ter uma `Transaction` vinculada;
  vira `PAID` no momento em que o pagamento é registrado. Não existe
  pagamento parcial de uma parcela — ela é paga por inteiro ou continua
  pendente (diferente de `Invoice`, que aceita `PARTIALLY_PAID`).
- **Status do empréstimo (derivado, não persistido):** "Em dia" (nenhuma
  parcela vencida sem pagamento), "Atrasado" (alguma `PENDING` com
  `dueDate` no passado), "Quitado" (todas `PAID`) — mesmo princípio de
  `deriveDisplayStatus` em `invoices/actions.ts`.
- **Registrar pagamento de uma parcela:** cria uma `Transaction` na
  `Account` escolhida pelo usuário, valor = `installment.amount`, sinal
  conforme a direção (`LENT` → positivo/entrada quando a pessoa paga de
  volta; `BORROWED` → negativo/saída quando o usuário paga), data =
  data do pagamento (hoje por padrão, editável — não necessariamente
  `dueDate`, pra registrar um pagamento atrasado ou adiantado
  corretamente). Vincula `LoanInstallment.transactionId` e marca
  `status: PAID`.
- **Excluir uma parcela paga / desfazer pagamento:** apaga a
  `Transaction` vinculada (ou só desvincula — a definir, ver Perguntas
  em aberto) e volta o status pra `PENDING`.
- **Excluir o empréstimo inteiro:** bloqueado se alguma parcela já foi
  paga (mesmo princípio de "não apagar histórico" de `cards`/
  `accounts`) — só permite excluir um empréstimo 100% `PENDING`, ou
  exige confirmação explícita se decidirmos permitir apagar em cascata
  (a definir).

## Recursos

### 1. Lista de Empréstimos (`/loans`)

- KPIs no topo (mesmo padrão `KpiGrid`/`KpiCard` de `/invoices`): "A
  receber" (soma de parcelas `PENDING` de empréstimos `LENT`), "A pagar"
  (idem `BORROWED`), "Parcelas atrasadas" (contagem, tom `warning`).
- Filtro por direção (Todos/A receber/A pagar) e por pessoa
  (reaproveita o seletor de pessoa já usado em outras telas).
- Um card por empréstimo: pessoa, descrição, direção (ícone/cor —
  `text-positive` pra `LENT`, `text-negative` pra `BORROWED`, mesma
  convenção de tokens semânticos do resto do app), valor total, "N de M
  parcelas pagas", próximo vencimento, valor restante.
- Responsivo (tabela `md`+ / cards abaixo disso, mesma regra `min-[700px]`
  já usada em `/invoices`).

### 2. Detalhe do Empréstimo (`/loans/[id]`)

- Cabeçalho: pessoa, direção, descrição, total, quanto já foi
  pago/recebido, quanto falta.
- Lista de parcelas (1 a N), cada uma com vencimento, valor, status
  (badge Pendente/Paga/Atrasada) e um botão "Registrar pagamento" nas
  pendentes — abre um dialog parecido com `PayInvoiceDialog`
  (`invoices/[id]/_components/pay-invoice-dialog.tsx`): escolhe a conta,
  confirma valor (pré-preenchido, não editável — ver regra acima) e
  data do pagamento.
- Cada parcela paga mostra um link/referência pra transação gerada
  (mesmo padrão de `invoice-detail-view.tsx` linkando pra
  `CreditTransactionSheet`).

### 3. Formulário de Criação/Edição (Sheet)

- Campos: Pessoa (picker), Direção (toggle "Emprestei" / "Peguei
  emprestado"), Descrição, Valor total (`AmountField`), Quantidade de
  parcelas, Data de início, Dia de vencimento (1–31, `TextField`
  numérico — mesmo tratamento que `closingDay`/`dueDay` já usam no
  formulário de cartão, `cards/_components/form/credit-card-form.tsx`).
- Edição: só permitida enquanto nenhuma parcela foi paga (mesma
  limitação que parcelamento de cartão tem hoje — "v1 limitation" citada
  em `transactions/actions.ts`) — depois disso, só exclusão de parcelas
  futuras/registro de pagamento, não recálculo do cronograma.

## Passos

1. `prisma/schema.prisma`: modelos `Loan`/`LoanInstallment` + enums
   acima; migração (`prisma migrate dev` trava em terminal
   não-interativo neste projeto — escrever o SQL à mão em
   `prisma/migrations/<timestamp>_add_loans/migration.sql`, depois
   `prisma migrate deploy` + `prisma generate`, mesmo fluxo já usado
   nesta sessão).
2. `loans/_schema/schema.ts`: `loanSchema` (pessoa, direção, descrição,
   valor, parcelas, data inicial), `registerLoanPaymentSchema`
   (installmentId, accountId, data).
3. `loans/actions.ts`:
   - `listLoans(filters)` — direção, pessoa; status derivado calculado
     em memória a partir das parcelas.
   - `getLoanDetail(id)` — empréstimo + parcelas + pessoa.
   - `createLoan(data)` — cria `Loan` + N `LoanInstallment` (dinero.js
     `allocate`, datas via `setDateClamped`/`addMonths` zonados).
   - `updateLoan(id, data)` — só quando nenhuma parcela paga (regra
     acima).
   - `deleteLoan(id)` — bloqueado se alguma parcela `PAID`.
   - `registerLoanPayment(installmentId, data)` — cria a `Transaction`,
     vincula, marca `PAID` (dentro de `prisma.$transaction`, mesmo
     padrão atômico de `payInvoice`).
   - `undoLoanPayment(installmentId)` — apaga/desvincula a transação,
     volta `PENDING` (ver Perguntas em aberto).
4. `loans/_components/`: `loans-view.tsx`, `_components/loan-card.tsx`,
   `[id]/_components/loan-detail-view.tsx`, `_components/form/
   loan-sheet.tsx`, `_components/register-payment-dialog.tsx`,
   `_components/delete-dialog.tsx`.
5. `scrn-loans.json` (pt-BR e en) — seguir as categorias padrão do
   `AGENTS.md` (`title`/`kpis`/`filters`/`card`/`table`/`dialog`/
   `toast`/`errors`).
6. Sidebar: adicionar item de navegação (`src/components/nav/
   app-sidebar.tsx`, `common.json` → `nav.loans`).

## Perguntas em aberto

Não decididas ainda — confirmar antes ou durante a implementação:

1. **Desfazer um pagamento** — apaga a `Transaction` de verdade, ou só
   desvincula (deixando a transação órfã, editável manualmente)? Apagar
   parece mais consistente com o resto do app (nenhum outro fluxo deixa
   transação órfã de propósito), mas vale confirmar.
2. **Juros** — fora de escopo pro v1 (parcelas de valor fixo, sem
   cálculo de juros/correção)? Assumindo que sim, pela ausência do tema
   nas decisões já tomadas.
3. **O desembolso inicial do empréstimo** (o dinheiro que sai/entra no
   dia 0, antes da 1ª parcela de devolução) — o app também registra
   isso como uma transação, ou o v1 assume que esse valor já
   aconteceu/foi registrado manualmente em `/transactions` antes de
   cadastrar o empréstimo aqui? Isso muda o modelo (precisaria de um
   `disbursementTransactionId` em `Loan`) — recomendo v1 SEM isso
   (o usuário lança o desembolso manualmente como uma transação comum,
   com a categoria "Empréstimo" já existente) pra não duplicar
   contabilização, mas precisa confirmação.
4. **Exclusão de empréstimo com parcelas pagas** — bloquear
   completamente (como proposto acima), ou permitir excluir mantendo as
   transações já geradas soltas (como hoje já acontece ao excluir uma
   conta/pessoa com histórico)?

## Pronto quando

- `/loans` lista corretamente os empréstimos (ambas direções), com KPIs
  batendo com a soma real das parcelas pendentes.
- Criar um empréstimo gera as N parcelas corretas (soma exata do total,
  vencendo todo mês no dia de vencimento configurado, não no dia da
  data de início).
- Registrar pagamento de uma parcela cria a `Transaction` certa (conta,
  valor, sinal conforme direção) e atualiza o status da parcela/
  empréstimo imediatamente (invalidation do TanStack Query).
- Responsivo (`md`+ tabela / mobile cards).
- Nenhum texto hardcoded; `pnpm lint` e `pnpm build` sem erros.
