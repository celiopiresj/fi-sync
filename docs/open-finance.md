# Open Finance pessoal — Meu Pluggy

Integração exclusiva do dono do projeto. O acesso é validado pelo id
autenticado no servidor em todas as operações; outros usuários não veem
o acesso no menu e recebem 404 ao tentar abrir a rota ou chamar as ações.

## Ativação

1. Crie sua conta em [Meu Pluggy](https://meu.pluggy.ai/) e autorize cada
   banco pelo aplicativo dele. O escopo desejado é conta e cartão Nubank,
   conta e cartão Itaú e cartões C6, next e Bradesco. A disponibilidade
   efetiva dos produtos depende do consentimento e dos dados do banco.
2. Entre no [Dashboard da Pluggy](https://dashboard.pluggy.ai/) com a mesma
   conta. Em Aplicações → sua aplicação → Demo → Conectar Conta, escolha
   **MeuPluggy**, em vez de escolher o banco diretamente ou o Sandbox.
   Cada banco autorizado se torna um item. Copie o `itemId` de cada um.
3. Configure no servidor (localmente, em `.env`, que não é versionado):
   - `OPEN_FINANCE_USER_ID`: id exato do seu usuário do Neon Auth.
   - `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET`: credenciais da aplicação
     no Dashboard. Nunca use o prefixo `NEXT_PUBLIC_` nem envie as chaves
     pelo chat. A tela só recebe os identificadores dos itens.
   Para resolver seu id pelo e-mail cadastrado e configurar o acesso
   exclusivamente no `.env` local, use
   `pnpm exec tsx scripts/configure-open-finance-owner.ts seu-email@example.com`.
   Esse comando lê a identidade no Neon Auth e não altera seu cadastro.
4. Aplique a migração `20261028120000_personal_open_finance` com
   `pnpm prisma migrate deploy` e gere o client com `pnpm prisma generate`.
   A CLI deve usar `DIRECT_URL` com a conexão **direta** do Neon, sem
   `-pooler` no hostname. Confira se há outras migrações pendentes antes
   de aplicar, para não misturar alterações de outras tarefas.
5. Reinicie o servidor e abra `/pt-BR/open-finance` ou `/en/open-finance`.
   O acesso também aparece no menu lateral e no final da tela Mais,
   exclusivamente para o usuário configurado.
6. Adicione nome e `itemId` de cada conexão. Selecione uma origem, vincule
   à conta correspondente no fi-sync, escolha o cartão físico quando
   aplicável e informe a data inicial que deseja importar. As contas e
   cartões de destino devem estar cadastrados e ativos no fi-sync.

Sem `OPEN_FINANCE_USER_ID`, ninguém tem acesso. Sem as credenciais da
Pluggy, somente o dono vê as instruções de configuração.

## Busca e revisão

Ao abrir uma origem vinculada, a tela busca os dados já coletados pelo
Meu Pluggy. **Buscar lançamentos** relê esses dados. O Meu Pluggy atualiza
as conexões a cada 24 horas; este botão não força uma nova atualização no
banco. Não há tarefa em segundo plano nem importação automática no livro
de transações nesta versão: o usuário revisa cada lançamento antes de
confirmá-lo.

- A lista é paginada pelo endpoint atual `/v2/transactions`. A busca inclui
  somente a conta externa selecionada e a data inicial configurada.
- **Importar lançamento** cria um lançamento confirmado no fi-sync.
  Não altera o saldo inicial nem cria as parcelas futuras de uma compra.
  Os dados da parcela recebida do banco são preservados.
- **Vincular ao existente** registra que um lançamento de mesma conta,
  data e valor já existe. As categorias, divisões por pessoa e demais
  informações do lançamento existente são preservadas.
- **Ignorar lançamento** registra sua decisão sem criar uma transação.
- Registros processados deixam de aparecer. Os comprovantes da importação
  permanecem mesmo que a transação local seja apagada depois.
- Uma possível duplicata por conta, data e valor exige vincular ou ignorar;
  não é criada automaticamente uma segunda transação.
- Para cartão, confira o fechamento e vencimento da fatura de destino.
  As datas sugeridas usam as configurações do cartão; a fatura real do
  banco pode ter datas diferentes. A importação não altera as datas de
  uma fatura já existente.
- Um pagamento recebido no cartão é bloqueado para criação como estorno.
  Registre o pagamento na tela de faturas e vincule-o se houver um
  lançamento equivalente, ou ignore a informação do cartão. A saída na
  conta bancária deve ser vinculada ao pagamento já cadastrado, evitando
  contar a despesa duas vezes.
- Transferências entre suas próprias contas devem ser registradas como
  transferências no fi-sync e cada lado vinculado ao registro do banco.
  A integração não tenta adivinhar pares a partir das descrições.
- Pendentes podem ser vistos, mas só são criados após o banco confirmar
  `POSTED`. A importação normaliza o sinal de cartão (débito positivo na
  Pluggy → despesa negativa no fi-sync) usando Dinero.js.
- Esta versão suporta destinos em BRL. Uma compra em moeda estrangeira
  só é importável se o provedor fornecer `amountInAccountCurrency` em
  reais; não há conversão cambial estimada.
- Alterações posteriores do provedor não sobrescrevem lançamentos já
  processados nem apagam dados locais. Revisões são feitas no fi-sync.

Desativar uma conexão bloqueia buscas e importações, preservando os
lançamentos e seus comprovantes. Para reativar, adicione novamente o
mesmo `itemId`; a autorização é validada novamente. Isso não revoga o
consentimento no banco: revogue-o pelo Meu Pluggy ou pelo banco quando
desejar encerrar o compartilhamento.

O plano pessoal admite até cinco conexões e não se destina a atender os
dados de outros usuários. A autorização do aplicativo no Meu Pluggy tem
validade própria e precisa ser renovada; os consentimentos de cada banco
também devem continuar válidos. Se uma renovação gerar outros ids,
revise e vincule os registros existentes para evitar duplicatas.

## Verificação

```bash
pnpm exec tsx scripts/check-open-finance.ts
pnpm exec tsx scripts/check-open-finance-database.ts
pnpm lint
pnpm build
```

Os testes focados usam respostas fictícias: não acessam dados financeiros
nem gravam no banco. O teste de banco usa apenas registros sintéticos
isolados, em uma transação que sempre é revertida, e verifica datas,
valores, duplicatas e preservação dos comprovantes. O teste de ponta a
ponta com dados reais depende das credenciais e autorizações pessoais.

Referência: [guia oficial de uso pessoal](https://docs.pluggy.ai/pt/docs/guides/meu-pluggy-personal-use).
