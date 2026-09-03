"use server";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { parseCalendarDate, todayCalendarDate, dateOnlyKey } from "@/lib/date";
import { listAccounts } from "../accounts/actions";
import { listCreditCardAccounts } from "../cards/actions";
import { listInvoices } from "../invoices/actions";
import { listInvestmentAccounts } from "../investments/actions";
import { listLoans } from "../loans/actions";
import { investmentAccountTypeValues } from "../investments/_schema/schema";
import { currentPeriod, periodRange } from "../transactions/_lib/period";

async function requireUserId() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

// This screen's whole purpose is aggregating every "real money" domain
// into one mobile summary — same "deliberately reaches across routes"
// exception (app)/(home)/actions.ts already documents, for the same
// reason: a dashboard depending on every leaf domain is what it's for,
// and the dependency only flows one direction (leaves → here).
export async function getWalletOverview() {
  const userId = await requireUserId();
  const todayDate = parseCalendarDate(todayCalendarDate());
  const currentMonthKey = todayCalendarDate().slice(0, 7);
  const { from } = periodRange(currentPeriod());
  const monthStartDate = parseCalendarDate(from);

  const [accounts, cardAccounts, invoices, investmentAccounts, loans, investmentMovement] =
    await Promise.all([
      listAccounts(),
      listCreditCardAccounts(),
      listInvoices(),
      listInvestmentAccounts(),
      listLoans(),
      // Net money moved into/out of investment & pocket accounts this
      // month (aportes - resgates) — the closest proxy to "ganho do mês"
      // available without a dedicated returns/yield tracker, since this
      // app doesn't record investment performance separately from the
      // transactions that move money in and out of those accounts.
      prisma.transaction.aggregate({
        where: {
          userId,
          account: { type: { in: [...investmentAccountTypeValues] } },
          date: { gte: monthStartDate, lte: todayDate },
        },
        _sum: { amount: true },
      }),
    ]);

  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);

  const openInvoices = invoices.filter((invoice) => invoice.displayStatus !== "PAID");
  const invoicesDueThisMonth = openInvoices
    .filter((invoice) => dateOnlyKey(invoice.dueDate).slice(0, 7) === currentMonthKey)
    .reduce((sum, invoice) => sum + invoice.remainingDue, 0);

  const totalInvested = investmentAccounts.reduce((sum, account) => sum + account.balance, 0);
  const investmentMovementThisMonth = investmentMovement._sum.amount?.toNumber() ?? 0;

  const totalReceivable = loans.reduce((sum, loan) => sum + loan.remainingTotal, 0);
  const peopleOwingCount = loans.filter((loan) => loan.remainingTotal > 0).length;

  return {
    totalBalance,
    accounts,
    cardAccounts,
    openInvoicesCount: openInvoices.length,
    invoicesDueThisMonth,
    totalInvested,
    investmentMovementThisMonth,
    totalReceivable,
    peopleOwingCount,
  };
}
