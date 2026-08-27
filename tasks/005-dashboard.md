# 005 — Dashboard

## Objetivo

Tela inicial com visão geral: saldo, receitas x despesas, gráfico de gastos
por categoria.

## Contexto

Depende de `001-data-model.md` e `004-transactions-screen.md` (reaproveita
lógica de busca de transações).

## Passos

1. Criar `src/messages/{pt-BR,en}/scrn-dashboard.json` seguindo exatamente
   a mesma convenção do `scrn-transactions.json` (ver `AGENTS.md` →
   Internationalization): `cards`, `chart`, `errors`, etc. — não inventar
   estrutura nova.
2. Rota `src/app/[locale]/page.tsx` (ou `/dashboard`, decidir se é a home).
3. Cards de resumo (saldo total, receitas/despesas do período) —
   reaproveitar padrão dos cards da tela de transações.
4. Gráfico de gastos por categoria — escolher lib de gráfico (não decidido
   ainda; avaliar Recharts ou similar, compatível com shadcn "chart").
5. Buscar dados via TanStack Query; considerar TanStack DB se a tela
   precisar cruzar transações + contas + categorias no client sem refetch
   (ver convenção em `AGENTS.md`).

## Pronto quando

- Dashboard mostra saldo e um gráfico com dados reais do banco (via seed).
