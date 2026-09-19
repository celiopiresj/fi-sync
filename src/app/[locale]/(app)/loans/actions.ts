"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { allocate, BRL, dinero, toDecimal } from "dinero.js";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/server";
import { parseCalendarDate, todayCalendarDate } from "@/lib/date";
import { computeLoanInstallmentDates } from "./_lib/installment-dates";
import {
  classifyLoanPaymentAdjustment,
  type LoanPaymentAdjustmentType,
} from "./_lib/loan-payment";
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
    where: { name: "Empréstimo", type: "LOAN", OR: [{ userId: null }, { userId }] },
  });
}

// Composes a payment's Transaction description out of independent tags
// (early settlement, interest, discount) rather than one message key per
// combination — the same "parts.filter(Boolean).join" shape the home
// screen's attention-list.tsx already uses for its own compound detail
// lines, applied here so registerLoanPayment and
// settleRemainingLoanInstallments don't each hardcode their own set of
// message keys for what's really the same three orthogonal facts.
function buildLoanPaymentDescription(
  t: Awaited<ReturnType<typeof getTranslations<"scrn-loans">>>,
  params: {
    description: string;
    number: number;
    count: number;
    adjustmentType: LoanPaymentAdjustmentType;
    isSettlement: boolean;
  },
): string {
  const parts = [
    t("payment.transactionDescription", {
      description: params.description,
      number: params.number,
      count: params.count,
    }),
    params.isSettlement ? t("payment.earlySettlementTag") : null,
    params.adjustmentType === "interest" ? t("payment.interestTag") : null,
    params.adjustmentType === "discount" ? t("payment.discountTag") : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

// People a loan can be tied to — includes "Eu" (isSelf), unlike some
// other person pickers in the app: a loan someone else registered on
// your behalf, or one you're tracking against yourself for bookkeeping,
// is a real case the picker needs to allow, not a mistake to filter out.
// Accounts are the checking/savings/cash set both the optional "valor
// recebido" disbursement and every installment payment can post to.
export async function getLoanFormOptions() {
  const userId = await requireUserId();

  const [people, accounts] = await Promise.all([
    prisma.person.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    }),
    prisma.account.findMany({
      where: { userId, type: { in: ["CHECKING", "SAVINGS", "CASH"] } },
      // isDefault (see its own comment in prisma/schema.prisma) rides
      // along on each account rather than a separately computed
      // defaultAccountId — every consumer here (loan-form.tsx,
      // register-payment-dialog.tsx, settle-loan-dialog.tsx) already
      // shares this one exact same account list/type filter, so each
      // just looks up `accounts.find((a) => a.isDefault)` itself instead
      // of threading a second id through three components.
      select: { id: true, name: true, isDefault: true },
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
      installments: {
        orderBy: { installmentNumber: "asc" },
        include: { transaction: { select: { amount: true } } },
      },
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
      // The actual money moved, not the nominal schedule — see
      // paidAmountOf's own comment (below getLoanDetail) for why an
      // interest/discount adjustment makes these diverge.
      paidTotal: paid.reduce((sum, i) => sum + paidAmountOf(i), 0),
      remainingTotal: pending.reduce((sum, i) => sum + i.amount.toNumber(), 0),
      overdueCount,
      nextDueDate: pending[0]?.dueDate ?? null,
      status,
    };
  });
}

// The real amount an already-paid installment cost — its linked
// Transaction's amount, not the installment's own `amount` — because
// registerLoanPayment/settleRemainingLoanInstallments can post a
// different figure once an interest/discount adjustment applies.
// `installment.amount` itself is NEVER mutated for this (see
// _schema/schema.ts's own comment on refineLoanPaymentAdjustment): it
// stays the original schedule so undoLoanPayment has something correct
// to revert back to. Falls back to the nominal amount only if the
// relation somehow didn't resolve (transactionId set but no matching
// row) — not an expected runtime path, just type-level defensiveness
// against a nullable include.
function paidAmountOf(installment: {
  amount: { toNumber(): number };
  transaction: { amount: { toNumber(): number } } | null;
}): number {
  return Math.abs(installment.transaction?.amount.toNumber() ?? installment.amount.toNumber());
}

export async function getLoanDetail(id: string) {
  const userId = await requireUserId();

  const loan = await prisma.loan.findFirst({
    where: { id, userId },
    include: {
      person: { select: { id: true, name: true } },
      installments: {
        orderBy: { installmentNumber: "asc" },
        include: { transaction: { select: { amount: true } } },
      },
    },
  });
  if (!loan) return null;

  const todayDate = parseCalendarDate(todayCalendarDate());
  const pendingCount = loan.installments.filter((i) => i.transactionId === null).length;

  return {
    id: loan.id,
    personId: loan.personId,
    person: loan.person,
    description: loan.description,
    dueDate: loan.dueDate,
    paidTotal: loan.installments
      .filter((i) => i.transactionId !== null)
      .reduce((sum, i) => sum + paidAmountOf(i), 0),
    remainingTotal: loan.installments
      .filter((i) => i.transactionId === null)
      .reduce((sum, i) => sum + i.amount.toNumber(), 0),
    // "Quitar restante" only makes sense with more than one pending
    // installment — with exactly one, it's the same action as that
    // row's own "Registrar pagamento" button.
    canSettleRemaining: pendingCount > 1,
    installments: loan.installments.map((installment) => {
      const isPaid = installment.transactionId !== null;
      const paidAmount = isPaid ? paidAmountOf(installment) : null;
      return {
        id: installment.id,
        installmentNumber: installment.installmentNumber,
        installmentCount: installment.installmentCount,
        dueDate: installment.dueDate,
        amount: installment.amount.toNumber(),
        // Only ever different from `amount` once an interest/discount
        // adjustment was applied at payment time — null while pending,
        // since there's nothing paid yet to have a real value.
        paidAmount,
        isPaid,
        isOverdue:
          installment.transactionId === null && installment.dueDate < todayDate,
      };
    }),
  };
}

async function validateLoan(data: LoanFormValues, accountRequiredMessage: string) {
  return loanSchema
    .superRefine((value, ctx) =>
      refineLoanReceived(value, ctx, { accountRequired: accountRequiredMessage }),
    )
    .safeParse(data);
}

export async function createLoan(
  data: LoanFormValues,
  // Only meaningful when the schedule's first due date is already in
  // the past — the create form asks the user in that case (see
  // PastInstallmentsDialog) whether to still create every installment
  // or only the ones still ahead. Ignored otherwise.
  options?: { skipPastInstallments?: boolean },
) {
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

  // Pure date math, no invoice-cycle cursor to advance (unlike
  // createCreditTransaction's own skip loop) — every installment's
  // dueDate was already computed upfront above, so skipping is just a
  // filter. Original 1-based installmentNumber is kept even for a
  // skipped schedule (e.g. installments 4..6 of 6 stay numbered that
  // way), same as the credit-card equivalent.
  const skipPastInstallments = options?.skipPastInstallments ?? false;
  const todayDate = parseCalendarDate(todayCalendarDate());
  const installmentsToCreate = dueDates
    .map((dueDate, index) => ({ dueDate, installmentNumber: index + 1 }))
    .filter(({ dueDate }) => !skipPastInstallments || dueDate >= todayDate);

  if (skipPastInstallments && installmentsToCreate.length === 0) {
    return { error: t("fields.installments.noneUpcoming") };
  }

  await prisma.$transaction(async (tx) => {
    await tx.loan.create({
      data: {
        userId,
        personId: value.personId,
        description: value.description,
        dueDate: firstDueDate,
        installments: {
          create: installmentsToCreate.map(({ dueDate, installmentNumber }) => ({
            installmentNumber,
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

// Reschedules the still-unpaid installments of a loan that already has
// SOME paid ones — the narrower sibling of the full recreate below,
// same "already-real payments can't be recomputed away, but what's
// still ahead can still move" rule recurrences' own
// cascadeRecurrenceDateShift (recurrences/actions.ts) follows. Only the
// DATE moves: description/amount/installment count/person are locked
// the moment any installment is paid (loan-form.tsx renders them
// read-only in that state), so there's no other content to cascade —
// unlike a recurrence, which keeps cascading content edits indefinitely.
// Paid installments (wherever they fall — registerLoanPayment doesn't
// require paying in order) keep their own dueDate/amount/installmentNumber
// exactly as they are; only the unpaid ones' dueDate is rewritten, in
// installmentNumber order, from computeLoanInstallmentDates anchored at
// the newly edited date — same month-spacing helper create/full-edit
// already use. Loan.dueDate itself ("the first installment's due date")
// is deliberately left untouched here: it's a historical fact about
// when the loan started, not the schedule being edited.
async function cascadeLoanDateShift(params: {
  newAnchor: Date;
  unpaidInstallmentIds: string[];
}) {
  const { newAnchor, unpaidInstallmentIds } = params;
  const dueDates = computeLoanInstallmentDates(newAnchor, unpaidInstallmentIds.length);

  await prisma.$transaction(
    unpaidInstallmentIds.map((installmentId, index) =>
      prisma.loanInstallment.update({
        where: { id: installmentId },
        data: { dueDate: dueDates[index] },
      }),
    ),
  );
}

// While EVERY installment is still unpaid, the whole schedule is deleted
// and regenerated from scratch, same "recompute isn't safe once real
// payments exist" reasoning credit-card installment editing has in
// transactions/actions.ts. Delete-then-recreate inside a $transaction,
// same convention updateCreditCardAccount's own Card[] reconciliation
// follows (tasks/013.md), so a failure partway through can't leave the
// loan with zero installments. Never touches the one-time "valor
// recebido" transaction createLoan may have posted — that's a
// create-only action, not part of the recurring schedule being edited
// here. Once SOME (but not all) installments are paid, this instead
// defers to cascadeLoanDateShift above — description/amount/count/person
// can no longer change, only the remaining schedule's date. Once ALL
// installments are paid (fully settled), there's nothing left to
// reschedule either, so that's still the original hard block.
export async function updateLoan(
  id: string,
  data: LoanFormValues,
  options?: { skipPastInstallments?: boolean },
) {
  const userId = await requireUserId();
  const t = await getTranslations("scrn-loans");
  const result = await validateLoan(data, t("errors.receivedAccountRequired"));
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }
  const value = result.data;

  const existing = await prisma.loan.findFirst({
    where: { id, userId },
    include: {
      installments: {
        orderBy: { installmentNumber: "asc" },
        select: { id: true, transactionId: true },
      },
    },
  });
  if (!existing) {
    return { error: "Not found" };
  }

  const unpaidInstallments = existing.installments.filter(
    (installment) => installment.transactionId === null,
  );

  if (unpaidInstallments.length !== existing.installments.length) {
    if (unpaidInstallments.length === 0) {
      return { error: t("errors.cannotEditPaid") };
    }
    await cascadeLoanDateShift({
      newAnchor: parseCalendarDate(value.dueDate),
      unpaidInstallmentIds: unpaidInstallments.map((installment) => installment.id),
    });
    revalidatePath("/loans");
    revalidatePath(`/loans/${id}`);
    return { error: null };
  }

  const person = await prisma.person.findUnique({
    where: { id: value.personId, userId },
  });
  if (!person) {
    return { error: "Invalid person" };
  }

  const firstDueDate = parseCalendarDate(value.dueDate);
  const dueDates = computeLoanInstallmentDates(firstDueDate, value.installments);

  const skipPastInstallments = options?.skipPastInstallments ?? false;
  const todayDate = parseCalendarDate(todayCalendarDate());
  const installmentsToCreate = dueDates
    .map((dueDate, index) => ({ dueDate, installmentNumber: index + 1 }))
    .filter(({ dueDate }) => !skipPastInstallments || dueDate >= todayDate);

  if (skipPastInstallments && installmentsToCreate.length === 0) {
    return { error: t("fields.installments.noneUpcoming") };
  }

  await prisma.$transaction([
    prisma.loanInstallment.deleteMany({ where: { loanId: id } }),
    prisma.loan.update({
      where: { id },
      data: {
        personId: value.personId,
        description: value.description,
        dueDate: firstDueDate,
        installments: {
          create: installmentsToCreate.map(({ dueDate, installmentNumber }) => ({
            installmentNumber,
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
// and links it. The amount posted is whatever the user typed as
// `paidAmount` — not necessarily the installment's own nominal `amount`;
// classifyLoanPaymentAdjustment (_lib/loan-payment.ts) compares the two
// only to tag the transaction's description ("Juros"/"Desconto"), it
// never changes what actually gets posted.
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
  const adjustment = classifyLoanPaymentAdjustment(
    installment.amount.toNumber(),
    value.paidAmount,
  );
  const signedAmount = -value.paidAmount;

  await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        userId,
        accountId: account.id,
        description: buildLoanPaymentDescription(t, {
          description: installment.loan.description,
          number: installment.installmentNumber,
          count: installment.installmentCount,
          adjustmentType: adjustment.type,
          isSettlement: false,
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

// Pays off every remaining installment of a loan in one go — the
// "quitação antecipada" case, where `paidAmount` is what settles the
// WHOLE remaining balance rather than one installment. Still one
// Transaction per installment (not one lump Transaction for all of
// them): LoanInstallment.transactionId is a one-to-one relation
// (prisma/schema.prisma), and keeping that intact means undoLoanPayment
// keeps working unchanged — undoing one installment from a settlement
// un-pays only that one, exactly like undoing any other payment.
// allocate() (dinero.js) splits `paidAmount` across installments by
// their nominal weight, without losing remainder cents — same technique
// payInvoice (invoices/actions.ts) already uses to split a payment
// across people instead of installments.
export async function settleRemainingLoanInstallments(
  loanId: string,
  data: RegisterLoanPaymentFormValues,
) {
  const userId = await requireUserId();

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, userId },
    include: {
      installments: {
        where: { transactionId: null },
        orderBy: { installmentNumber: "asc" },
      },
    },
  });
  if (!loan) {
    return { error: "Not found", count: 0 };
  }
  if (loan.installments.length === 0) {
    return { error: "Nothing to settle", count: 0 };
  }

  const result = registerLoanPaymentSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data", count: 0 };
  }
  const value = result.data;

  const account = await prisma.account.findFirst({
    where: { id: value.accountId, userId, type: { in: ["CHECKING", "SAVINGS", "CASH"] } },
  });
  if (!account) {
    return { error: "Invalid account", count: 0 };
  }

  const t = await getTranslations("scrn-loans");
  const paidAt = parseCalendarDate(value.paidAt);
  const loanCategory = await findLoanCategory(userId);
  const nominalTotal = loan.installments.reduce(
    (sum, installment) => sum + installment.amount.toNumber(),
    0,
  );
  const adjustment = classifyLoanPaymentAdjustment(nominalTotal, value.paidAmount);
  const shares = allocate(
    dinero({ amount: Math.round(value.paidAmount * 100), currency: BRL }),
    loan.installments.map((installment) => Math.round(installment.amount.toNumber() * 100)),
  );

  await prisma.$transaction(async (tx) => {
    for (const [index, installment] of loan.installments.entries()) {
      const signedAmount = -Number(toDecimal(shares[index]!));
      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          description: buildLoanPaymentDescription(t, {
            description: loan.description,
            number: installment.installmentNumber,
            count: installment.installmentCount,
            adjustmentType: adjustment.type,
            isSettlement: true,
          }),
          amount: signedAmount,
          date: paidAt,
          categoryId: loanCategory?.id,
          splits: {
            create: [{ personId: loan.personId, amount: signedAmount }],
          },
        },
      });

      await tx.loanInstallment.update({
        where: { id: installment.id },
        data: { transactionId: transaction.id },
      });
    }
  });

  revalidatePath("/loans");
  revalidatePath(`/loans/${loanId}`);
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/people");
  return { error: null, count: loan.installments.length };
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
