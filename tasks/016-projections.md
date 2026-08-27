# Tarefa 016 - Tela de Projeções (Forecast)

## Objetivo

Criar uma tela de "Projeções" para visualização detalhada do fluxo de caixa e saldo projetado para os próximos meses.

## Perguntas em Aberto / Definições Pendentes

1. **Cálculo do Saldo Previsto:** Como deve ser calculado o "Saldo previsto" (ex: Saldo Atual de contas + Entradas Futuras - Saídas Futuras - Faturas de Cartão de Crédito a vencer)?
2. **Gasto no cartão:** Este valor representa as compras feitas dentro daquele mês específico, ou o total das faturas com vencimento naquele mês (impacto real no caixa)?
3. **Horizonte de tempo:** Quantos meses à frente devem ser projetados e carregados por padrão (ex: 6 meses, 12 meses)?

## Alterações Propostas

### Navegação e Rotas

- **`src/components/nav/nav-items.ts`**: Adicionar `"projections"` aos tipos de `labelKey` e adicionar a rota `/projections` no grupo `planning` (Planejamento), utilizando um ícone adequado (ex: `TrendUpIcon`).
- **`src/app/[locale]/(app)/projections/page.tsx`**: Rota principal da tela, que invocará as actions e passará os dados ao client component.

### Lógica (Server Actions)

- **`src/app/[locale]/(app)/projections/actions.ts`**:
  - Action `getProjections(monthsAhead)`: Calcula o saldo atual das contas (dinheiro/corrente), varre transações futuras e ocorrências geradas (`Transaction`), agrupando entradas e saídas mês a mês para acumular e retornar o saldo projetado.

### Componentes de Interface

- **`src/app/[locale]/(app)/projections/_components/projections-view.tsx`**: Client component que renderiza o contêiner com rolagem horizontal (`flex overflow-x-auto gap-4`).
- **`src/app/[locale]/(app)/projections/_components/projection-card.tsx`**: Card individual de cada mês contendo:
  - Label do mês/ano (ex: `AGO/26`)
  - Valor do Saldo Previsto
  - Tabela de detalhamento (Gasto no cartão, Gasto em conta, Total gasto, Previsão a receber)
  - Link "Ver extrato ->" que navega para `/transactions` filtrando pelas datas daquele mês.

### Internacionalização (i18n)

- **`src/messages/*/scrn-projections.json`**: Novos arquivos contendo as strings traduzidas da tela (títulos, labels dos cards, etc).
- **`src/messages/*/common.json`**: Adicionar a chave `"projections"` em `nav`.
