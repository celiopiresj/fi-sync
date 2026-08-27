# 006 — Recursos avançados de adicionar transação

## Objetivo

Estender o formulário de transação (task 004, já implementado) com cinco
recursos pedidos: valor com expressão matemática, preview de fatura antes
de salvar, recorrência rápida (gera várias transações de uma vez),
parcelamento com escolha entre valor da parcela ou valor total, e um modo
em lote (tabela estilo planilha) como alternativa ao formulário único.

## Contexto

- Estende `src/app/[locale]/(app)/transactions/` — reaproveita
  `schema.ts`, `actions.ts`, `transaction-form.tsx`, `transaction-drawer.tsx`.
- Nenhuma dependência nova: expressão matemática vai ser um parser
  pequeno escrito à mão (sem `eval`), `date-fns` já cobre os cálculos de
  data de daily/weekly/monthly, e o preview de fatura reaproveita a lógica
  que já existe em `resolveInvoiceForDate` (só separada em uma função pura
  sem escrita no banco).
- `Recurrence`/`Transaction.recurrenceId` já existem no schema
  (`prisma/schema.prisma`) exatamente pra isso — o comentário lá diz que
  geração ainda não está implementada. Essa task implementa a geração
  *manual* (o usuário pede N repetições e elas são criadas na hora), não
  um gerador automático rodando em background — o comentário do schema
  vai ser atualizado pra refletir isso.

## Recursos

### 1. Valor com expressão matemática

- Campo `amount` aceita `+ - * /` e parênteses (ex: `120+35`,
  `250*3`), além de número simples.
- Abaixo do campo, preview ao vivo do resultado calculado (ex:
  "= R$ 155,00"), só aparece quando a expressão é diferente de um número
  puro.
- Parser próprio (`src/lib/math/safe-expression.ts`): tokeniza e resolve
  só `+ - * / ( )` e números com vírgula ou ponto — sem `eval`/`Function`.
- O valor validado/enviado ao Server Action é o resultado calculado, não a
  string digitada.

### 2. Preview de fatura (antes de salvar)

- Quando a conta escolhida é `CREDIT_CARD`, ao preencher a data o form
  mostra uma linha tipo "Cai na fatura de nov/2026 (fecha 05/11, vence
  15/11)", calculada sem gravar nada no banco ainda.
- Nova função pura `computeInvoiceCycle(date, { closingDay, dueDay })` em
  `actions.ts` (sem Prisma) — extraída da lógica que já existe em
  `resolveInvoiceForDate`, que passa a chamá-la internamente.
- Novo Server Action `previewInvoiceCycle(accountId, date)`: busca uma
  `Invoice` já existente pra esse ciclo; se não existir, retorna o cálculo
  de `computeInvoiceCycle` sem criar a fatura (só cria de fato quando a
  transação é salva, como já acontece hoje).

### 3. Recorrência rápida

- Novo campo no form: "Repetir" — nenhuma / diária / semanal / mensal.
  Se diferente de "nenhuma", pede quantas repetições.
- Ao salvar, cria uma `Recurrence` (frequency, startDate = data
  escolhida) + N `Transaction`, uma por data (`addDays`/`addWeeks`/
  `addMonths` do date-fns), todas com `recurrenceId` apontando pra essa
  regra.
- **Decisão**: recorrência e parcelamento não se combinam nessa v1 — os
  dois campos ficam mutuamente exclusivos na UI (escolher um esconde o
  outro), pra não ter que lidar com "12 parcelas × 6 repetições" agora.

### 4. Parcelamento: valor da parcela vs. valor total

- Hoje `createTransaction` sempre trata o valor digitado como total e
  divide por `installments`. Isso vira uma opção explícita: toggle
  "Valor digitado é: [Valor total da compra] / [Valor de cada parcela]".
- Se "valor total": divide por N (comportamento atual).
- Se "valor da parcela": usa o valor digitado em cada parcela sem
  dividir, e mostra "Total: R$ X" calculado (valor × N) como referência.

### 5. Modo em lote

- Toggle no topo do drawer de criar: "Único" / "Em lote". Em lote troca
  o conteúdo do drawer por uma tabela: linhas com data, descrição,
  categoria, pessoa, conta, valor (aceita expressão matemática também);
  botões de adicionar/remover linha.
- Sem cartão/parcelamento/recorrência no lote — são lançamentos simples,
  um por linha, cada um podendo ir pra uma conta diferente.
- Novo Server Action `createTransactionsBatch(rows)`, dentro de
  `prisma.$transaction` (tudo ou nada), reaproveitando a validação de
  `decimalString`/`splitSchema` por linha (splits ficam de fora do lote —
  só pessoa única por linha, sem divisão).
- Cada linha tem seu próprio seletor de tipo (receita/despesa) — decisão
  confirmada.

## Não muda (metadados já existentes)

Nenhuma migration nova. Pessoa (`TransactionSplit`), categoria, conta/
cartão, `recurrenceId` e `installmentGroupId/Number/Count` já existem no
schema — as telas futuras de fatura, orçamento por categoria, extrato de
recorrências e projeção de saldo vão só consultar o que já está sendo
gravado, sem precisar de nada extra desta task.

## Passos

1. `src/lib/math/safe-expression.ts` — parser e `evaluateExpression`.
2. `schema.ts` — `amount` passa a tentar `evaluateExpression` antes do
   coerce numérico; novos campos `recurrence`, `recurrenceCount`,
   `installmentAmountMode`; refine: recorrência x parcelamento mutuamente
   exclusivos.
3. `actions.ts` — extrair `computeInvoiceCycle`; `previewInvoiceCycle`;
   geração de recorrência em `createTransaction`; `createTransactionsBatch`
   + schema de linha do lote.
4. `transaction-form.tsx` — preview do valor calculado, preview de
   fatura, campos de recorrência, toggle de parcela/total.
5. Novo `batch-transaction-table.tsx` + `transaction-drawer.tsx` ganha o
   toggle Único/Lote (drawer fica mais largo em modo lote).
6. Mensagens novas em `scrn-transactions.json` (pt-BR + en): recorrência,
   lote, previews — seguindo `AGENTS.md` (nada hardcoded).
7. Atualizar comentário de `Recurrence` em `prisma/schema.prisma`
   (geração manual implementada; geração automática/background continua
   futura).

## Pronto quando

- Valor aceita expressão matemática com preview correto.
- Preview de fatura aparece antes de salvar pra contas de cartão.
- Recorrência gera as N transações certas, com `recurrenceId` compartilhado.
- Parcelamento respeita o toggle total/por-parcela.
- Modo em lote cria várias transações de uma vez, atômico.
- Nenhum texto hardcoded; `pnpm lint`/`pnpm build` sem erros.

## Status

**Implementado.** Também converti o diálogo de criar/editar transação
(task 004) de `Dialog` centralizado pra `Drawer` (vaul): lado direito no
desktop, de baixo pra cima no mobile/tablet (breakpoint `md`, via
`useIsMobile`) — pedido em paralelo a esta task, arquivo renomeado de
`transaction-dialog.tsx` pra `transaction-drawer.tsx`.

Arquivos novos: `src/lib/math/safe-expression.ts` (parser testado
isoladamente com 14 casos, incluindo divisão por zero e expressão
inválida), `batch-transaction-table.tsx`. `schema.ts`/`actions.ts`
estendidos conforme o plano; `prisma/schema.prisma` com os comentários de
`Recurrence` atualizados.

Bug encontrado e corrigido durante a revisão: no cruzamento
recorrência × cartão de crédito, cada ocorrência precisa resolver sua
própria fatura a partir da sua própria data — a implementação inicial
reaproveitava o "cursor" do parcelamento (que assume todas as parcelas na
mesma data nominal), o que geraria faturas erradas pra recorrências
diárias/semanais. Corrigido em `actions.ts` (`createTransaction`).

Nenhuma dependência nova (parser próprio, `vaul`/`date-fns` já existiam).
Todas as chaves de tradução novas verificadas programaticamente nas duas
locales (pt-BR/en) — nenhuma faltando.

Falta rodar localmente: `pnpm lint`, `pnpm build`, e teste manual dos 5
recursos + do drawer responsivo (o `tsc --noEmit` do sandbox não é
conclusivo aqui — o `node_modules` local está incompleto, o mesmo motivo
que já impede `pnpm install`/lint completos no sandbox).
