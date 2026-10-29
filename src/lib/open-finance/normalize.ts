import { BRL, dinero, isNegative, multiply, toDecimal } from "dinero.js";
import { OpenFinanceError, type PluggyTransaction, type ReviewPaymentMethod } from "@/lib/open-finance/schema";

export function transactionKey(row: PluggyTransaction): string {
  return row.providerId ? `bank:${row.providerId}` : `pluggy:${row.id}`;
}

export function inferPaymentMethod(row: PluggyTransaction, accountType: string): "" | ReviewPaymentMethod {
  if (accountType === "CREDIT") return "";
  const op = (row.operationType ?? "").toUpperCase();
  const desc = row.description.toUpperCase();
  if (op.includes("PIX") || /\bPIX\b/.test(desc)) return "PIX";
  if (op.includes("BOLETO") || /\bBOLETO\b/.test(desc)) return "BOLETO";
  if (op.includes("DEBIT") || op.includes("COMPRA") || /\b(COMPRA|DEBITO|DÉBITO)\b/.test(desc)) return "DEBIT_CARD";
  if (op.includes("TED") || op.includes("DOC") || op.includes("TRANSFER") || /\b(TED|DOC|TRANSFERENCIA|TRANSFERÊNCIA)\b/.test(desc)) return "BANK_TRANSFER";
  if (op.includes("SAQUE") || op.includes("CASH") || /\b(SAQUE|DINHEIRO)\b/.test(desc)) return "CASH";
  return "";
}

export function isNegativeAmount(amount: string): boolean {
  return isNegative(dinero({ amount: Number(amount.replace(".", "")), currency: BRL }));
}

export function normalizedAmount(row: PluggyTransaction, accountType: string): string {
  if (row.currencyCode !== "BRL" && row.amountInAccountCurrency == null) {
    throw new OpenFinanceError("currency");
  }
  const value = row.amountInAccountCurrency ?? row.amount;
  // Convert the API's decimal representation once, at the boundary to
  // Dinero. All monetary arithmetic (including credit-card sign flips)
  // then uses Dinero, and Prisma receives a decimal string.
  const decimal = value.toFixed(2);
  const amount = dinero({ amount: Number(decimal.replace(".", "")), currency: BRL });
  return toDecimal(accountType === "CREDIT" ? multiply(amount, -1) : amount);
}

export function isCardPayment(row: PluggyTransaction, accountType: string): boolean {
  return accountType === "CREDIT" && ["PAGAMENTO", "PAGAMENTO_FATURA"].includes(row.operationType ?? "");
}

export function checkedCursor(cursor: string, accountId: string, fromDate: string): string {
  if (!cursor.startsWith("?") || cursor.includes("#")) throw new OpenFinanceError("invalid");
  const query = new URLSearchParams(cursor);
  const allowed = ["accountId", "dateFrom", "after"];
  if ([...query.keys()].some((key) => !allowed.includes(key) || query.getAll(key).length !== 1) ||
    query.get("accountId") !== accountId || query.get("dateFrom") !== fromDate || !query.get("after")) {
    throw new OpenFinanceError("invalid");
  }
  return cursor;
}
