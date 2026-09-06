import { addMonths } from "date-fns";
import {
  formatLocalCalendarDate,
  parseCalendarDate,
  toAppZoned,
} from "@/lib/date";
import type { StatementEntry } from "@/lib/statement-import/schema";
import {
  emptyBatchRow,
  emptyCreditBatchRow,
  type BatchRowFormValues,
  type CreditBatchRowFormValues,
} from "../_schema/schema";

// Turns what the importer read out of a fatura/extrato into the exact
// same batch rows the manual flows already build, so an imported row
// goes through `createTransactionsBatch`/`createCreditTransactionsBatch`
// with no special-casing on the server at all — the import is a way of
// FILLING the batch form, not a second way of creating transactions.

// Every queued batch row stores its amount already resolved, in the
// app's comma-decimal convention (see batch-amounts.ts).
function toAmountString(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

// Shifts a date-only "YYYY-MM-DD" by whole months in APP_TIME_ZONE's
// wall clock (AGENTS.md's date rule: never plain date-fns math on a
// date-only value). No `fromAppZoned` on the way out because the result
// never becomes an instant — the caller wants the shifted calendar
// digits back as a string, which is exactly what the zoned Date's own
// getters read.
function shiftCalendarMonths(date: string, months: number): string {
  return formatLocalCalendarDate(addMonths(toAppZoned(parseCalendarDate(date)), months));
}

// A fatura shows an installment purchase from the middle: "PARC 03/10"
// on the 05/09 statement is one charge of a purchase actually made two
// months earlier, for ten times that amount. The app models the whole
// plan from its original purchase date, so the row is rebuilt that way —
// back-date by (number - 1) months, keep the line's own value as the
// per-installment amount, and let `createCreditTransactionsBatch`
// regenerate all ten charges across their invoices. Registering the line
// as a one-off on the statement date instead would leave every remaining
// installment invisible to the invoice projections, which is most of
// what importing a fatura is for.
//
// Returns null when the line isn't part of a plan (or reports one that
// doesn't add up, e.g. "5/3"), in which case the row stays a plain
// single charge on its own date.
function resolveInstallmentPlan(
  entry: StatementEntry,
): { purchaseDate: string; count: number } | null {
  const { installmentNumber: number, installmentTotal: total } = entry;
  if (!number || !total) return null;
  if (!Number.isInteger(number) || !Number.isInteger(total)) return null;
  if (total < 2 || number < 1 || number > total) return null;
  return {
    purchaseDate: shiftCalendarMonths(entry.date, -(number - 1)),
    count: total,
  };
}

export function statementEntriesToCreditRows(
  entries: StatementEntry[],
  options: { accountId: string; cardId: string; defaultPersonId: string | null },
): CreditBatchRowFormValues[] {
  return entries.map((entry) => {
    const plan = resolveInstallmentPlan(entry);
    return {
      ...emptyCreditBatchRow,
      accountId: options.accountId,
      cardId: options.cardId,
      personId: options.defaultPersonId ?? "",
      description: entry.description.trim(),
      type: entry.kind,
      date: plan?.purchaseDate ?? entry.date,
      amount: toAmountString(entry.amount),
      installments: String(plan?.count ?? 1),
      // The line's value is what the card bills per month, not the
      // purchase total — "total" would divide it again by the count.
      installmentAmountMode: plan ? "perInstallment" : "total",
      // The already-billed installments of an imported plan are the
      // point: they're the invoices the user is importing. Skipping them
      // would leave the plan's history with holes.
      skipPastInstallments: false,
    };
  });
}

export function statementEntriesToDebitRows(
  entries: StatementEntry[],
  options: { accountId: string; defaultPersonId: string | null },
): BatchRowFormValues[] {
  return entries.map((entry) => ({
    ...emptyBatchRow,
    accountId: options.accountId,
    personId: options.defaultPersonId ?? "",
    description: entry.description.trim(),
    type: entry.kind,
    date: entry.date,
    amount: toAmountString(entry.amount),
    // Left empty (not defaulted to OTHER) when the statement doesn't say
    // how the money moved: the row then reads as incomplete and the user
    // picks, instead of a wrong-but-valid value slipping through.
    paymentMethod: entry.paymentMethod ?? "",
  }));
}
