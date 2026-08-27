# fi-sync — planejamento inicial

Sequência sugerida para dar início ao desenvolvimento. Cada arquivo é uma
tarefa: contexto, decisões já tomadas, perguntas em aberto e critério de
pronto. Siga a ordem — cada uma depende da anterior.

1. [001-data-model.md](./001-data-model.md) — modelo de dados no Prisma
2. [002-auth.md](./002-auth.md) — autenticação
3. [003-app-shell.md](./003-app-shell.md) — layout base, navegação, seletor de idioma
4. [004-transactions-screen.md](./004-transactions-screen.md) — primeira tela real (transações)
5. [005-dashboard.md](./005-dashboard.md) — tela inicial com resumo
6. [006-transacoes-recursos-avancados.md](./006-transacoes-recursos-avancados.md) — expressão matemática, preview de fatura, recorrência rápida, parcelamento total/por-parcela, modo em lote
7. [007.md](./007.md) — tela de contas (corrente, poupança, dinheiro)
8. [010.md](./010.md) — tela de pessoas (cadastro para dividir despesas)
9. [011.md](./011.md) — responsividade da tela de transações (mobile)
10. [013.md](./013.md) — tela de cartão de crédito e de fatura
11. [014.md](./014.md) — tela de compras no cartão de crédito (separada de transações, revisa 013)

Convenções de stack e mensagens (next-intl, Prisma, shadcn etc.) estão no
`AGENTS.md` na raiz do projeto — todo código novo deve seguir o que está lá.
