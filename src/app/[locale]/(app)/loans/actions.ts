"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/server";
import { parseCalendarDate, todayCalendarDate } from "@/lib/date";
import { computeLoanInstallmentDates } from "./_lib/installment-dates";
import {
  loanSchema,
  refineLoanReceived,
  registerLoanPaymentSchema,
  type LoanFormValues,
  type RegisterLoanPaymentFormValues,
} from "./_schema/schema";

async function requireUserId() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

// Every payment a loan generates is filed under this category, so it
// reads apart from ordinary spending in reports/budgets (see
// src/lib/default-categories.ts) — looked up by name/type rather than a
// fixed id since it's a plain seeded row, not something the schema
// pins. Falls back to no category if a user somehow deleted it; never
// blocks the payment over it.
async function findLoanCategory(userId: string) {
  return prisma.category.findFirst({
    where: { name: "Empréstimo", type: "EXPENSE", OR: [{ userId: null }, { userId }] },
  });
}

// People a loan can be tied to — never the user themselves (a loan is
// never "with myself"), same isSelf exclusion transactions/actions.ts's
// own person-attribution logic is careful about elsewhere, just applied
// as a straight filter here instead. Accounts are the checking/savings/
// cash set both the optional "valor recebido" disbursement and every
// installment payment can post to.
export async function getLoanFormOptions() {
  const userId = await requireUserId();

  const [people, accounts] = await Promise.all([
    prisma.person.findMany({
      where: { userId, isSelf: false },
      orderBy: { name: "asc" },
    }),
    prisma.account.findMany({
      where: { userId, type: { in: ["CHECKING", "SAVINGS", "CASH"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { people, accounts };
}

export type LoanStatus = "ON_TRACK" | "OVERDUE" | "SETTLED";

export type LoanFilters = {
  personId?: string;
};

// Status is derived here, never stored — same "compute from real rows,
// don't persist a value that can drift" convention Invoice's own
// displayStatus follows (invoices/actions.ts). SETTLED once every
// installment has a linked transaction; OVERDUE if any unpaid one's
// dueDate has already passed; ON_TRACK otherwise.
export async function listLoans(filters: LoanFilters = {}) {
  const userId = await requireUserId();
  const todayDate = parseCalendarDate(todayCalendarDate());

  const loans = await prisma.loan.findMany({
    where: {
      userId,
      ...(filters.personId ? { personId: filters.personId } : {}),
    },
    include: {
      person: { select: { id: true, name: true } },
      installments: { orderBy: { installmentNumber: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return loans.map((loan) => {
    const pending = loan.installments.filter((i) => i.transactionId === null);
    const paid = loan.installments.filter((i) => i.transactionId !== null);
    const overdueCount = pending.filter((i) => i.dueDate < todayDate).length;
    const status: LoanStatus =
      pending.length === 0 ? "SETTLED" : overdueCount > 0 ? "OVERDUE" : "ON_TRACK";

    return {
      id: loan.id,
      personId: loan.personId,
      person: loan.person,
      description: loan.description,
      dueDate: loan.dueDate,
      installmentAmount: loan.installments[0]?.amount.toNumber() ?? 0,
      installmentCount: loan.installments.length,
      paidInstallmentCount: paid.length,
      paidTotal: paid.reduce((sum, i) => sum + i.amount.toNumber(), 0),
      remainingTotal: pending.reduce((sum, i) => sum + i.amount.toNumber(), 0),
      overdueCount,
      nextDueDate: pending[0]?.dueDate ?? null,
      status,
    };
  });
}

export async function getLoanDetail(id: string) {
  const userId = await requireUserId();

  const loan = await prisma.loan.findFirst({
    where: { id, userId },
    include: {
      person: { select: { id: true, name: true } },
      installments: { orderBy: { installmentNumber: "asc" } },
    },
  });
  if (!loan) return null;

  const todayDate = parseCalendarDate(todayCalendarDate());

  return {
    id: loan.id,
    personId: loan.personId,
    person: loan.person,
    description: loan.description,
    dueDate: loan.dueDate,
    paidTotal: loan.installments
      .filter((i) => i.transactionId !== null)
      .reduce((sum, i) => sum + i.amount.toNumber(), 0),
    remainingTotal: loan.installments
      .filter((i) => i.transactionId === null)
      .reduce((sum, i) => sum + i.amount.toNumber(), 0),
    installments: loan.installments.map((installment) => ({
      id: installment.id,
      installmentNumber: installment.installmentNumber,
      installmentCount: installment.installmentCount,
      dueDate: installment.dueDate,
      amount: installment.amount.toNumber(),
      isPaid: installment.transactionId !== null,
      isOverdue:
        installment.transactionId === null && installment.dueDate < todayDate,
    })),
  };
}

async function validateLoan(data: LoanFormValues, accountRequiredMessage: string) {
  return loanSchema
    .superRefine((value, ctx) =>
      refineLoanReceived(value, ctx, { accountRequired: accountRequiredMessage }),
    )
    .safeParse(data);
}

export async function createLoan(data: LoanFormValues) {
  const userId = await requireUserId();
  const t = await getTranslations("scrn-loans");
  const result = await validateLoan(data, t("errors.receivedAccountRequired"));
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }
  const value = result.data;

  const person = await prisma.person.findUnique({
    where: { id: value.personId, userId },
  });
  if (!person) {
    return { error: "Invalid person" };
  }

  const hasReceived = Boolean(value.receivedAmount && value.receivedAccountId);
  if (hasReceived) {
    const account = await prisma.account.findFirst({
      where: { id: value.receivedAccountId, userId },
    });
    if (!account) {
      return { error: "Invalid account" };
    }
  }

  const firstDueDate = parseCalendarDate(value.dueDate);
  const dueDates = computeLoanInstallmentDates(firstDueDate, value.installments);

  await prisma.$transaction(async (tx) => {
    await tx.loan.create({
      data: {
        userId,
        personId: value.personId,
        description: value.description,
        dueDate: firstDueDate,
        installments: {
          create: dueDates.map((dueDate, index) => ({
            installmentNumber: index + 1,
            installmentCount: value.installments,
            dueDate,
            amount: value.installmentAmount,
          })),
        },
      },
    });

    // "Valor recebido" — the money actually received when the loan
    // started, optionally logged as a one-time income Transaction dated
    // today (not the first installment's due date, which can land a
    // month or more later) and attributed to the same person via a
    // split, same shape every other person-attributed Transaction uses.
    if (hasReceived) {
      const receivedAmount = Number(value.receivedAmount.replace(",", "."));
      await tx.transaction.create({
        data: {
          userId,
          accountId: value.receivedAccountId,
          description: t("received.transactionDescription", {
            description: value.description,
          }),
          amount: receivedAmount,
          date: parseCalendarDate(todayCalendarDate()),
          splits: {
            create: [{ personId: value.personId, amount: receivedAmount }],
          },
        },
      });
    }
  });

  revalidatePath("/loans");
  if (hasReceived) {
    revalidatePath("/transactions");
    revalidatePath("/accounts");
  }
  return { error: null };
}

// Only reachable while every installment is still unpaid (see the
// errors.cannotEditPaid check below) — the whole schedule is deleted
// and regenerated from scratch, same "recompute isn't safe once real
// payments exist" reasoning credit-card installment editing has in
// transactions/actions.ts. Delete-then-recreate inside a $transaction,
// same convention updateCreditCardAccount's own Card[] reconciliation
// follows (tasks/013.md), so a failure partway through can't leave the
// loan with zero installments. Never touches the one-time "valor
// recebido" transaction createLoan may have posted — that's a
// create-only action, not part of the recurring schedule being edited
// here.
export async function updateLoan(id: string, data: LoanFormValues) {
  const userId = await requireUserId();
  const t = await getTranslations("scrn-loans");
  const result = await validateLoan(data, t("errors.receivedAccountRequired"));
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }
  const value = result.data;

  const existing = await prisma.loan.findFirst({
    where: { id, userId },
    include: { installments: { select: { transactionId: true } } },
  });
  if (!existing) {
    return { error: "Not found" };
  }

  if (existing.installments.some((installment) => installment.transactionId !== null)) {
    return { error: t("errors.cannotEditPaid") };
  }

  const person = await prisma.person.findUnique({
    where: { id: value.personId, userId },
  });
  if (!person) {
    return { error: "Invalid person" };
  }

  const firstDueDate = parseCalendarDate(value.dueDate);
  const dueDates = computeLoanInstallmentDates(firstDueDate, value.installments);

  await prisma.$transaction([
    prisma.loanInstallment.deleteMany({ where: { loanId: id } }),
    prisma.loan.update({
      where: { id },
      data: {
        personId: value.personId,
        description: value.description,
        dueDate: firstDueDate,
        installments: {
          create: dueDates.map((dueDate, index) => ({
            installmentNumber: index + 1,
            installmentCount: value.installments,
            dueDate,
            amount: value.installmentAmount,
          })),
        },
      },
    }),
  ]);

  revalidatePath("/loans");
  revalidatePath(`/loans/${id}`);
  return { error: null };
}

// Blocked once any installment has a real payment linked — same
// "archive/keep history, don't silently lose it" principle
// accounts/cards follow, except a loan has no archive state of its own
// (v1 scope, tasks/017-emprestimos.md) so this is a hard block instead.
export async function deleteLoan(id: string) {
  const userId = await requireUserId();

  const existing = await prisma.loan.findFirst({
    where: { id, userId },
    include: { installments: { select: { transactionId: true } } },
  });
  if (!existing) {
    return { error: "Not found" };
  }

  const t = await getTranslations("scrn-loans");
  if (existing.installments.some((installment) => installment.transactionId !== null)) {
    return { error: t("errors.cannotDeletePaid") };
  }

  await prisma.loan.delete({ where: { id } });

  revalidatePath("/loans");
  return { error: null };
}

// Registers one installment as paid — always a plain expense (money
// leaving the chosen account), never an income; a loan the user made TO
// someone isn't tracked by this feature. Creates the real settlement
// Transaction (same principle payInvoice, invoices/actions.ts, already
// follows for a fatura payment), tags it with the "Empréstimo" category,
// and links it. Never a partial amount: the installment's own `amount`
// is what gets posted, not anything the user types.
export async function registerLoanPayment(
  installmentId: string,
  data: RegisterLoanPaymentFormValues,
) {
  const userId = await requireUserId();
  const result = registerLoanPaymentSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }
  const value = result.data;

  const installment = await prisma.loanInstallment.findFirst({
    where: { id: installmentId, loan: { userId } },
    include: { loan: true },
  });
  if (!installment) {
    return { error: "Not found" };
  }
  if (installment.transactionId) {
    return { error: "Already paid" };
  }

  const account = await prisma.account.findFirst({
    where: { id: value.accountId, userId, type: { in: ["CHECKING", "SAVINGS", "CASH"] } },
  });
  if (!account) {
    return { error: "Invalid account" };
  }

  const t = await getTranslations("scrn-loans");
  const paidAt = parseCalendarDate(value.paidAt);
  const loanCategory = await findLoanCategory(userId);
  const signedAmount = -installment.amount.toNumber();

  await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        userId,
        accountId: account.id,
        description: t("payment.transactionDescription", {
          description: installment.loan.description,
          number: installment.installmentNumber,
          count: installment.installmentCount,
        }),
        amount: signedAmount,
        date: paidAt,
        categoryId: loanCategory?.id,
        splits: {
          create: [{ personId: installment.loan.personId, amount: signedAmount }],
        },
      },
    });

    await tx.loanInstallment.update({
      where: { id: installmentId },
      data: { transactionId: transaction.id },
    });
  });

  revalidatePath("/loans");
  revalidatePath(`/loans/${installment.loanId}`);
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/people");
  return { error: null };
}

// Deletes the settlement Transaction a payment created — LoanInstallment.
// transactionId's own onDelete: SetNull (prisma/schema.prisma) reverts
// this installment to pending as part of that same delete, no separate
// update needed.
export async function undoLoanPayment(installmentId: string) {
  const userId = await requireUserId();

  const installment = await prisma.loanInstallment.findFirst({
    where: { id: installmentId, loan: { userId } },
  });
  if (!installment) {
    return { error: "Not found" };
  }
  if (!installment.transactionId) {
    return { error: "Not paid" };
  }

  await prisma.transaction.delete({ where: { id: installment.transactionId } });

  revalidatePath("/loans");
  revalidatePath(`/loans/${installment.loanId}`);
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/people");
  return { error: null };
}
