// pt-BR labels for the enum values the bot reads back to the user.
//
// Deliberately not routed through next-intl, same reasoning as
// persona.ts: a webhook has no locale to resolve (there's no request from
// a browser, no cookie, no Accept-Language worth trusting), the bot only
// ever speaks Portuguese, and these strings are consumed by the model as
// part of a tool result rather than rendered by a component. The app's
// own screens keep using their `scrn-*` messages for the same enums.
//
// Every tool result that exists to be read back out loud (the create
// tools' `summary`) carries these instead of the raw enum, so the model
// has the right word right there and can't decide to echo "EXPENSE" at
// the user. The list tools keep the raw value too — the model needs it to
// pass back into a later call — and add the label alongside it.

export const CATEGORY_TYPE_LABELS: Record<string, string> = {
  EXPENSE: "Despesa",
  INCOME: "Receita",
  INVESTMENT: "Investimento",
  // System-only types (see CategoryType in prisma/schema.prisma). The bot
  // can't create one, but it can read a transaction already tagged with
  // one, so both still need a label.
  LOAN: "Empréstimo",
  CARD_PAYMENT: "Fatura de cartão",
};

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: "Conta corrente",
  SAVINGS: "Poupança",
  INVESTMENT: "Investimento",
  POCKET: "Caixinha",
  CREDIT_CARD: "Cartão de crédito",
  CASH: "Dinheiro",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Dinheiro",
  DEBIT_CARD: "Débito",
  CREDIT_CARD: "Crédito",
  BANK_TRANSFER: "Transferência",
  PIX: "Pix",
  BOLETO: "Boleto",
  OTHER: "Outro",
};

export const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  COMPLETED: "Concluído",
  FAILED: "Falhou",
};

export const RECURRENCE_LABELS: Record<string, string> = {
  none: "Não se repete",
  daily: "Todo dia",
  weekly: "Toda semana",
  monthly: "Todo mês",
};

export const TRANSACTION_KIND_LABELS: Record<string, string> = {
  expense: "Despesa",
  income: "Receita",
};

// Falls back to the raw value rather than throwing or returning an empty
// string: a value this map hasn't caught up with should still surface as
// something, and seeing the raw enum is a better failure than seeing
// nothing at all.
export function labelFor(map: Record<string, string>, value: string): string {
  return map[value] ?? value;
}
