"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/server";
import { formatPersonName } from "@/lib/format-person-name";
import { personSchema, refinePerson, type PersonFormValues } from "./_schema/schema";
import { splitPersonPhone } from "./_lib/phone";
import { getCashCycle, periodMonthRange } from "./_lib/cash-cycle";
import type { StatementPeriod } from "./_types/types";
import { parseCalendarDate, todayCalendarDate } from "@/lib/date";

async function requireUserId() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

// Every Person for the user, with how many TransactionSplit rows point at
// them — surfaced in the list so the delete confirmation can warn (or
// block, see deletePerson) before the user tries to remove someone with
// real history attached.
export async function listPeople() {
  const userId = await requireUserId();
  const todayDate = parseCalendarDate(todayCalendarDate());

  const [people, cashBalances] = await Promise.all([
    prisma.person.findMany({
      where: { userId },
      include: { _count: { select: { splits: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.transactionSplit.groupBy({
      by: ["personId"],
      where: {
        // Cash splits settle immediately, so this is meant to reflect
        // what's actually happened — a recurrence can generate real,
        // already-persisted PENDING Transaction rows dated in the
        // future (see recurrences/actions.ts), and those must never
        // count toward this "current balance" figure. Same rule
        // accounts/actions.ts's listAccounts and projections/actions.ts's
        // computeMonthSeries both follow for their own balance sums.
        transaction: {
          userId,
          account: { type: { not: "CREDIT_CARD" } },
          date: { lte: todayDate },
        },
      },
      _sum: { amount: true },
    }),
  ]);

  // Same "cash settles immediately, card only once its invoice is paid"
  // rule as getPersonStatement's `balance` below — kept as a second,
  // batched (groupBy over every person at once, not one aggregate per
  // person) query here since the list needs every person's number in one
  // page load. A card purchase enters this figure only when its invoice
  // is actually paid, and it does so through this very query, with no
  // second term: paying an invoice posts the settlement expense on a
  // CHECKING/SAVINGS/CASH account (payInvoice restricts the paying
  // account to those) carrying one negative split per person it covers,
  // so `account: { type: { not: "CREDIT_CARD" } }` above already picks
  // it up. There used to be a separate `paidCardBalances` groupBy over
  // exactly those settlement splits added on top of this one, which
  // counted every invoice payment twice — verified against real data:
  // one person whose only settlement split was -187,18 had a true
  // balance of 565,47 reported as 378,29. Deliberately excludes this
  // month's still-open/
  // unpaid card charges (unlike getPersonStatement's `totalToSettle`,
  // which layers those in) — that figure is period-specific and would
  // need a per-person invoice lookup to compute for a whole list, so the
  // list shows the cheaper all-time settled figure only. Sign: positive
  // = the user owes this person (same convention as "Saldo na conta" /
  // "Total a pagar" on the person detail page), negative = this person
  // owes the user.
  const balanceByPersonId = new Map<string, number>();
  for (const row of cashBalances) {
    balanceByPersonId.set(
      row.personId,
      (balanceByPersonId.get(row.personId) ?? 0) +
        (row._sum.amount?.toNumber() ?? 0),
    );
  }

  return people.map((person) => ({
    id: person.id,
    name: person.name,
    phoneCountryCode: person.phoneCountryCode,
    phone: person.phone,
    colorStyle: person.colorStyle,
    isSelf: person.isSelf,
    includeInBudget: person.includeInBudget,
    splitsCount: person._count.splits,
    balance: balanceByPersonId.get(person.id) ?? 0,
  }));
}

async function validatePerson(data: PersonFormValues) {
  const t = await getTranslations("scrn-people");
  const schema = personSchema.superRefine((value, ctx) =>
    refinePerson(value, ctx, {
      messages: { invalidPhone: t("errors.invalidPhone") },
    }),
  );
  return schema.safeParse(data);
}

export async function createPerson(data: PersonFormValues) {
  const userId = await requireUserId();
  const result = await validatePerson(data);

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }

  const phone = splitPersonPhone(result.data.phone);

  const person = await prisma.person.create({
    data: {
      userId,
      name: formatPersonName(result.data.name),
      phoneCountryCode: phone.phoneCountryCode ?? undefined,
      phone: phone.phone ?? undefined,
      colorStyle: result.data.colorStyle,
      includeInBudget: result.data.includeInBudget,
    },
  });

  revalidatePath("/people");
  // getBudgetWithSpending (budgets/actions.ts) sums every included
  // person's own share of each category — a new person created with
  // the toggle on shifts every month's spent-per-category totals, not
  // just this route's own list.
  if (result.data.includeInBudget) revalidatePath("/budgets");
  // Callers that create a person inline from another form (e.g. the
  // transaction form's "Cadastrar nova pessoa") use this to select the
  // new person immediately instead of just refreshing the list and
  // making the user find them again.
  return { error: null, person: { id: person.id, name: person.name } };
}

export async function updatePerson(id: string, data: PersonFormValues) {
  const userId = await requireUserId();
  const result = await validatePerson(data);

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }

  const existing = await prisma.person.findUnique({ where: { id, userId } });
  if (!existing) {
    return { error: "Not found" };
  }

  const phone = splitPersonPhone(result.data.phone);
  // The self person's own row never submits this field
  // (person-form.tsx hides the toggle for it) — `existing.isSelf`
  // guards against a stale/tampered client payload flipping it anyway,
  // since self must always count regardless of this flag.
  const includeInBudget = existing.isSelf ? false : result.data.includeInBudget;

  await prisma.person.update({
    where: { id },
    data: {
      name: formatPersonName(result.data.name),
      phoneCountryCode: phone.phoneCountryCode,
      phone: phone.phone,
      colorStyle: result.data.colorStyle,
      includeInBudget,
    },
  });

  revalidatePath("/people");
  // getBudgetWithSpending (budgets/actions.ts) sums every included
  // person's own share of each category — only worth revalidating that
  // route when the flag actually flipped, not on every unrelated edit
  // (a renamed phone number doesn't change any budget total).
  if (includeInBudget !== existing.includeInBudget) revalidatePath("/budgets");
  return { error: null };
}

// `TransactionSplit.person` is `onDelete: Cascade` (see prisma/schema.prisma)
// — deleting a Person with existing splits would silently wipe the
// attribution off those past transactions. Blocked server-side (the
// authoritative check) rather than just relying on the client's
// (possibly stale) splitsCount from listPeople.
export async function deletePerson(id: string) {
  const userId = await requireUserId();
  const t = await getTranslations("scrn-people");

  const person = await prisma.person.findUnique({
    where: { id, userId },
    include: { _count: { select: { splits: true, loans: true } } },
  });
  if (!person) {
    return { error: "Not found" };
  }

  // The self ("Eu") Person is permanent (see sync-user.ts's own comment)
  // — every person-attribution default in the app relies on exactly one
  // always existing, so deleting it here would break that guarantee.
  if (person.isSelf) {
    return { error: t("errors.cannotDeleteSelf") };
  }

  if (person._count.splits > 0) {
    return { error: t("errors.hasSplits", { count: person._count.splits }) };
  }

  // Loan.personId is also `onDelete: Cascade` (prisma/schema.prisma) —
  // same reasoning as the splits check above, so a person's loan history
  // isn't silently wiped out either.
  if (person._count.loans > 0) {
    return { error: t("errors.hasLoans", { count: person._count.loans }) };
  }

  await prisma.person.delete({ where: { id } });

  revalidatePath("/people");
  return { error: null };
}

// The person detail page's (people/[id]) statement for one period. Three
// different notions of "settled" feed the same running number:
// - Cash movements (non credit-card) count toward `balance` the moment
//   they happen — no gating.
// - Credit-card purchases only count once this specific person's own
//   share of the invoice has actually been paid (payInvoice,
//   invoices/actions.ts, may be partial/manual — see that function) —
//   until then they only show up in `cardSections` as a pending amount,
//   via `pendingCardTotal`. This mirrors how the app owner actually
//   fronts the card bill to the bank first, and only then is what each
//   person owes back "real" — see AGENTS.md-adjacent discussion in this
//   route's task notes.
// - Loan installments tied to this person (see prisma/schema.prisma's
//   Loan model) count once registerLoanPayment (loans/actions.ts) links
//   a real settlement Transaction — until then they show up in
//   `loanItems` as a pending amount, via `pendingLoanTotal`. Always a
//   real expense (registerLoanPayment only ever posts a negative
//   settlement transaction), so a pending installment SUBTRACTS from
//   totalToSettle below, the same direction any other expense would —
//   not netted the opposite way pendingCardTotal is.
// `balance` is all-time (every month ever, not just this period) —
// `movements`/`cardSections`/`loanItems` are what's shown for the
// selected period, mainly so there's something concrete to review/send
// before nudging someone via WhatsApp.
export async function getPersonStatement(personId: string, period: StatementPeriod) {
  const userId = await requireUserId();

  const person = await prisma.person.findUnique({ where: { id: personId, userId } });
  if (!person) return null;

  const cashCycle = getCashCycle(period);
  const { from: monthFrom, to: monthTo } = periodMonthRange(period);
  const todayDate = parseCalendarDate(todayCalendarDate());

  const [
    movements,
    cashBalanceAgg,
    paidThisMonthAgg,
    cardAccounts,
    pendingLoanInstallments,
  ] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        userId,
        account: { type: { not: "CREDIT_CARD" } },
        splits: { some: { personId } },
        date: { gte: cashCycle.start, lte: cashCycle.end },
      },
      include: { splits: { where: { personId } } },
      orderBy: { date: "asc" },
    }),
    // Same "no future-dated PENDING transaction may count toward a
    // current balance" rule as listPeople's own cashBalances above.
    prisma.transactionSplit.aggregate({
      where: {
        personId,
        transaction: {
          userId,
          account: { type: { not: "CREDIT_CARD" } },
          date: { lte: todayDate },
        },
      },
      _sum: { amount: true },
    }),
    // "Já pago no mês" — the person's cash movements within the plain
    // calendar month (day 1 to the month's last day), a different window
    // from `movements` above (which uses the 20-19 cash cycle). Purely
    // informational — doesn't feed `totalToSettle`.
    prisma.transactionSplit.aggregate({
      where: {
        personId,
        transaction: {
          userId,
          account: { type: { not: "CREDIT_CARD" } },
          date: { gte: monthFrom, lte: monthTo },
        },
      },
      _sum: { amount: true },
    }),
    prisma.account.findMany({
      where: { userId, type: "CREDIT_CARD" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // This person's own loan installments still due — same due-date-in-
    // this-month scoping as cardSections below, so a loan payment lands
    // in the statement/WhatsApp message for whichever month it's
    // actually due, not when the loan itself was created. Every loan
    // installment is a plain expense the user owes this person (see
    // prisma/schema.prisma's Loan model comment) — unlike a card
    // purchase, there's no "who fronted it" direction to resolve, so
    // these feed `loanItems` directly rather than needing their own
    // per-loan section/isPaid the way cardSections does.
    prisma.loanInstallment.findMany({
      where: {
        loan: { userId, personId },
        transactionId: null,
        dueDate: { gte: monthFrom, lte: monthTo },
      },
      include: { loan: { select: { description: true } } },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  // One section per credit-card account that has an Invoice DUE in this
  // calendar month AND at least one purchase split to this person —
  // cards with neither are left out entirely rather than shown empty.
  // Matched by dueDate, not closingDate — same "which month a credit
  // purchase belongs to" convention transactions/actions.ts's own
  // effectiveDate uses (a row's period is its invoice's due date, not
  // its closing date). Matching by closingDate instead used to put a
  // purchase under a different month here than the one /transactions
  // would show it under for the exact same period — confirmed against
  // real data: an installment due 12/09 (September, per effectiveDate)
  // has its own invoice CLOSING 29/08, so the old closingDate match
  // surfaced it under "Agosto" here while /transactions already called
  // it "Setembro".
  const cardSectionResults = await Promise.all(
    cardAccounts.map(async (account) => {
      const invoice = await prisma.invoice.findFirst({
        where: {
          accountId: account.id,
          dueDate: { gte: monthFrom, lte: monthTo },
        },
        include: {
          transactionInvoices: {
            where: { transaction: { splits: { some: { personId } } } },
            include: {
              transaction: { include: { splits: { where: { personId } } } },
            },
            orderBy: { transaction: { date: "asc" } },
          },
          // This person's own share of whatever's already been paid
          // against the invoice — a settlement transaction only carries
          // a split for this personId when they were actually part of
          // that specific payment's allocation (auto-proportional or
          // manual, see payInvoice in invoices/actions.ts).
          payments: {
            include: {
              transaction: { include: { splits: { where: { personId } } } },
            },
          },
        },
      });

      if (!invoice || invoice.transactionInvoices.length === 0) return null;

      const items = invoice.transactionInvoices.map((ti) => ({
        id: ti.transaction.id,
        description: ti.transaction.description,
        date: ti.transaction.date,
        // Guaranteed present: the transactionInvoices query above only
        // pulled transactions with a split for this exact personId.
        amount: ti.transaction.splits[0]!.amount.toNumber(),
        installmentNumber: ti.transaction.installmentNumber,
        installmentCount: ti.transaction.installmentCount,
      }));
      const total = items.reduce((sum, item) => sum + item.amount, 0);

      // Both `total` and each payment's split are negative (expense
      // sign) — summing them the same way `total` is built keeps the
      // signs consistent, so `remaining` is 0 once this person's whole
      // share has been settled, whether the invoice itself ended up
      // fully PAID or only PARTIALLY_PAID (e.g. everyone else's share
      // was paid separately).
      const paidForPerson = invoice.payments.reduce(
        (sum, payment) => sum + (payment.transaction.splits[0]?.amount.toNumber() ?? 0),
        0,
      );
      const remaining = total - paidForPerson;

      return {
        accountId: account.id,
        accountName: account.name,
        invoiceId: invoice.id,
        closingDate: invoice.closingDate,
        isPaid: Math.abs(remaining) < 0.01,
        items,
        total,
        // What this person has already settled against this invoice, as
        // its own field rather than left for the view to derive from
        // `total - remaining` (AGENTS.md: no computation in components) —
        // the section's footer shows it whenever it isn't zero, so the
        // badge can go back to being the plain sum of the rows listed
        // underneath it instead of silently netting the payment in.
        paid: paidForPerson,
        remaining,
      };
    }),
  );

  const cardSections = cardSectionResults.filter(
    (section): section is NonNullable<typeof section> => section !== null,
  );

  // Card purchases reach this figure only through the invoice payment
  // that settled them — that settlement is itself a cash transaction
  // with this person's split on it, so `cashBalanceAgg` above is the
  // whole story. See listPeople's own comment for the double-count this
  // replaced.
  const balance = cashBalanceAgg._sum.amount?.toNumber() ?? 0;

  const pendingCardTotal = cardSections
    .filter((section) => !section.isPaid)
    .reduce((sum, section) => sum + section.remaining, 0);

  const loanItems = pendingLoanInstallments.map((installment) => ({
    id: installment.id,
    description: installment.loan.description,
    date: installment.dueDate,
    // Kept as a positive magnitude here, same as cardSections' own
    // items — display sites (statement-message.ts, person-detail-
    // view.tsx) style it as an expense (text-negative / no "+"), and
    // pendingLoanTotal below is SUBTRACTED from totalToSettle rather
    // than negated per-item here.
    amount: installment.amount.toNumber(),
    installmentNumber: installment.installmentNumber,
    installmentCount: installment.installmentCount,
  }));
  // Kept as a positive magnitude here (used as-is for the "Total
  // empréstimos" line, statement-message.ts/person-detail-view.tsx) but
  // SUBTRACTED below, not added — a pending loan installment is a real
  // expense (see registerLoanPayment, loans/actions.ts, which always
  // posts a negative/expense settlement transaction), so it has to
  // reduce totalToSettle the same direction an expense reduces any
  // other balance, not inflate it.
  const pendingLoanTotal = loanItems.reduce((sum, item) => sum + item.amount, 0);

  return {
    person: {
      id: person.id,
      name: person.name,
      phoneCountryCode: person.phoneCountryCode,
      phone: person.phone,
      colorStyle: person.colorStyle,
    },
    period,
    cashCycle,
    movements: movements.map((transaction) => ({
      id: transaction.id,
      description: transaction.description,
      date: transaction.date,
      amount: transaction.splits[0]!.amount.toNumber(),
    })),
    cardSections,
    loanItems,
    balance,
    paidThisMonth: paidThisMonthAgg._sum.amount?.toNumber() ?? 0,
    pendingCardTotal,
    pendingLoanTotal,
    totalToSettle: balance + pendingCardTotal - pendingLoanTotal,
  };
}
