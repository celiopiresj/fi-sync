import { APP_TIME_ZONE, todayCalendarDate } from "@/lib/date";
import { TELEGRAM_COMMANDS_LINE } from "./commands";

// The bot IS Fi-Sync — not "an assistant that happens to have access to
// Fi-Sync". Everything here is model-facing plumbing, deliberately not
// routed through next-intl: these are instructions to a model, not UI
// copy, and there's no locale to resolve from a webhook anyway (the user
// writes in Portuguese, and the app's own default locale is pt-BR).
//
// Kept short on purpose. This block is re-sent on EVERY step of a
// tool-calling turn, so a paragraph nobody reads is a paragraph paid for
// several times per message against Groq's per-minute budget. Two whole
// sections could go once the tools started taking names instead of ids:
// the "list before you write" ritual, and the read-back-then-confirm
// dance — the confirmation is now built by the app (summary.ts) and
// answered without the model at all (draft.ts).
export function buildFiSyncInstructions(): string {
  return [
    "Você é o Fi-Sync, o app de finanças pessoais do próprio usuário, falando com ele pelo Telegram.",
    "Fale sempre na primeira pessoa como o Fi-Sync (\"registrei aqui\", \"no seu Nubank\"), nunca como um assistente genérico, e nunca diga que é uma IA ou que consulta um \"banco de dados\".",
    "",
    "Conversa:",
    "- Português do Brasil, tom de mensagem: curto, direto, sem introdução nem despedida.",
    "- Só texto puro: nada de Markdown, tabelas ou emoji.",
    "- Valores como R$ 1.234,56; datas em dia/mês (com ano só fora do ano corrente).",
    "- Se faltar informação, pergunte uma coisa só, a mais importante.",
    "- Nunca mostre código técnico ao usuário (EXPENSE, PIX, DEBIT_CARD): as ferramentas já devolvem tudo em português.",
    "",
    "Dados:",
    "- Você só enxerga os dados deste usuário. Se não veio de uma ferramenta, você não sabe — nunca invente saldo, lançamento ou fatura.",
    "- Valor negativo é despesa, positivo é receita. Compra no cartão conta no mês em que a fatura vence.",
    "",
    "Lançamentos (createTransaction, uma só para qualquer conta, cartão incluído):",
    "- Passe os NOMES de conta, categoria e pessoas, do jeito que o usuário falou. Não precisa listar nada antes: se o nome não bater, a ferramenta devolve as opções e aí você pergunta.",
    "- Escolha a categoria óbvia sozinho.",
    "- Chame SEMPRE com confirmed=false. O resumo e o \"posso registrar?\" saem prontos do app, e a resposta do usuário é tratada fora de você.",
    "- Preencha sozinho o que a mensagem entregar: paymentMethod (\"débito\" DEBIT_CARD, \"pix\" PIX, \"dinheiro\" CASH, \"ted\" BANK_TRANSFER, \"boleto\" BOLETO); \"4x de 100\" = amountIsPerInstallment true, \"400 em 4x\" = false; \"todo mês\" recurrence monthly; pending=true se o dinheiro ainda não saiu; kind=income para entrada ou estorno.",
    "- Dividido (\"rachei com a Maria\"): preencha splits, uma entrada por pessoa, partes positivas somando o total, e a PRIMEIRA é quem pagou. Sem divisão, splits vazio.",
    "",
    "Cadastro (só categoria e pessoa; conta e cartão só pelo app):",
    "- Reaproveite o que já existe: \"iFood\" entra em \"Alimentação\", não vira categoria nova.",
    "- Crie só a pedido ou quando não houver nada que sirva, sempre com confirmed=false antes.",
    "- Se vier alreadyExists, siga sem comentar. Depois de cadastrar, retome o que estava fazendo.",
    "",
    `Hoje é ${todayCalendarDate()} (fuso ${APP_TIME_ZONE}). Use essa data para resolver \"hoje\", \"ontem\", \"esse mês\".`,
  ].join("\n");
}

// Shown by /start (before linking), /ajuda and whenever an unknown chat
// talks to the bot. Plain strings for the same reason as above.
export const TELEGRAM_REPLIES = {
  linkInstructions: [
    "Oi! Eu sou o Fi-Sync.",
    "",
    "Pra eu conseguir ver as suas finanças, você precisa vincular esta conversa à sua conta:",
    "1. Abra o Fi-Sync e vá em Mais → Telegram.",
    "2. Toque em gerar código.",
    "3. Me mande aqui: /vincular SEUCODIGO",
  ].join("\n"),
  linked:
    "Pronto, vinculado! Agora é só falar comigo: \"quanto eu gastei esse mês?\", \"qual o saldo do Nubank?\", \"almoço 32 no débito\" ou \"jantar 90 no pix, rachei com a Maria\". Manda /ajuda pra ver tudo que eu faço.",
  rebound:
    "Pronto, vinculado! Essa conta estava ligada a outra conversa do Telegram — agora é esta aqui que vale.",
  linkCodeInvalid:
    "Esse código não confere. Gere um novo no Fi-Sync em Mais → Telegram e me mande de novo.",
  linkCodeExpired:
    "Esse código já expirou. Gere um novo no Fi-Sync em Mais → Telegram e me mande de novo.",
  linkCodeMissing: "Manda assim, com o código junto: /vincular SEUCODIGO",
  alreadyLinked: "Esta conversa já está vinculada à sua conta do Fi-Sync.",
  unlinked:
    "Desvinculei esta conversa e apaguei o nosso histórico. Quando quiser voltar, gere um código novo no app.",
  notLinked: "Esta conversa não está vinculada a nenhuma conta do Fi-Sync.",
  historyCleared: "Esqueci o que a gente conversou. Pode começar de novo.",
  // The two answers to a pending "posso registrar?" — both sent without
  // ever calling the model (src/app/api/telegram/route.ts).
  draftCancelled: "Beleza, não registrei nada. Se quiser, me manda de novo do jeito certo.",
  draftFailed:
    "Não consegui registrar isso agora. Me manda o lançamento de novo, por favor.",
  help: [
    "Sou o Fi-Sync. Fala comigo normal, em português:",
    "",
    "- \"quanto eu gastei esse mês?\"",
    "- \"qual o saldo das minhas contas?\"",
    "- \"quanto tá a fatura do cartão?\"",
    "- \"meus últimos lançamentos\"",
    "- \"quanto a Maria me deve?\"",
    "- \"almoço 32 no débito\" (eu confirmo antes de registrar)",
    "- \"tênis 400 em 4x no cartão\"",
    "- \"jantar 90 no pix, rachei com a Maria\"",
    "- \"netflix 55 todo mês no cartão\"",
    "",
    "Também cadastro categoria e pessoa nova quando faltar (conta e cartão, só pelo app).",
    "",
    TELEGRAM_COMMANDS_LINE,
  ].join("\n"),
  unsupportedMessage:
    "Por enquanto eu só entendo texto — me manda o que você quer em palavras.",
  failure:
    "Deu ruim aqui do meu lado e não consegui responder. Tenta de novo daqui a pouco.",
  // Groq's free tier caps tokens per MINUTE, and one tool-calling turn
  // costs a few thousand — so this is a normal thing to hit, not a bug.
  // Saying how long to wait beats a generic failure the user can only
  // respond to by retrying immediately and making it worse.
  rateLimited: (seconds: number | null) =>
    seconds
      ? `Bati no limite de uso da IA agora. Me manda de novo em ${seconds} segundos.`
      : "Bati no limite de uso da IA agora. Me manda de novo daqui a pouco.",
} as const;
