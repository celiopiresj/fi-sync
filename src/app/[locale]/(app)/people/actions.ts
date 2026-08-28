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

  const [people, cashBalances, paidCardBalances] = await Promise.all([
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
    // Sums each person's share of the actual settlement transaction(s) a
    // card invoice payment created (InvoicePayment.transaction), not the
    // original purchase splits gated by the invoice's overall status —
    // an invoice can now be PARTIALLY_PAID with only SOME people's
    // shares actually settled (manual allocation, see payInvoice in
    // invoices/actions.ts), so "was this person paid" has to be read off
    // what was really paid on their behalf, not the invoice's aggregate
    // state.
    prisma.transactionSplit.groupBy({
      by: ["personId"],
      where: {
        transaction: {
          userId,
          invoicePayment: { invoice: { account: { type: "CREDIT_CARD" } } },
        },
      },
      _sum: { amount: true },
    }),
  ]);

  // Same "cash settles immediately, card only once its invoice is paid"
  // rule as getPersonStatement's `balance` below — kept as a second,
  // batched (groupBy over every person at once, not one aggregate per
  // person) query pair here since the list needs every person's number
  // in one page load. Deliberately excludes this month's still-open/
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
  for (const row of paidCardBalances) {
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
    splitsCount: person._count.splits,
    balance: balanceByPersonId.get(person.id) ?? 0,
  }));
}

// Marks `id` as the Person representing the user themselves, and unsets
// it on every other Person for this user in the same transaction — at
// most one isSelf per user, enforced here since Prisma's schema DSL has
// no partial/conditional unique index for it (see the field's own
// comment in schema.prisma). The projections screen (tasks/016) reads
// this to sum only the user's own share of a split transaction.
export async function setSelfPerson(id: string) {
  const userId = await requireUserId();

  const person = await prisma.person.findUnique({ where: { id, userId } });
  if (!person) {
    return { error: "Not found" };
  }

  await prisma.$transaction([
    prisma.person.updateMany({
      where: { userId, isSelf: true },
      data: { isSelf: false },
    }),
    prisma.person.update({ where: { id }, data: { isSelf: true } }),
  ]);

  revalidatePath("/people");
  revalidatePath("/projections");
  return { error: null };
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
    },
  });

  revalidatePath("/people");
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

  await prisma.person.update({
    where: { id },
    data: {
      name: formatPersonName(result.data.name),
      phoneCountryCode: phone.phoneCountryCode,
      phone: phone.phone,
      colorStyle: result.data.colorStyle,
    },
  });

  revalidatePath("/people");
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
    include: { _count: { select: { splits: true } } },
  });
  if (!person) {
    return { error: "Not found" };
  }

  if (person._count.splits > 0) {
    return { error: t("errors.hasSplits", { count: person._count.splits }) };
  }

  await prisma.person.delete({ where: { id } });

  revalidatePath("/people");
  return { error: null };
}

// The person detail page's (people/[id]) statement for one period. Two
// very different notions of "settled" feed the same running number:
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
// `balance` is all-time (every month ever, not just this period) —
// `movements`/`cardSections` are what's shown for the selected period,
// mainly so there's something concrete to review/send before nudging
// someone via WhatsApp.
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
    paidCardBalanceAgg,
    paidThisMonthAgg,
    cardAccounts,
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
    // Same "read off what was actually settled, not the invoice's
    // aggregate status" rule as listPeople's own paidCardBalances above —
    // sums this person's share of the real settlement transaction(s), not
    // their original purchase splits gated by invoice.status.
    prisma.transactionSplit.aggregate({
      where: {
        personId,
        transaction: {
          userId,
          invoicePayment: { invoice: { account: { type: "CREDIT_CARD" } } },
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
  ]);

  // One section per credit-card account that has an Invoice closing in
  // this calendar month AND at least one purchase split to this person —
  // cards with neither are left out entirely rather than shown empty.
  const cardSectionResults = await Promise.all(
    cardAccounts.map(async (account) => {
      const invoice = await prisma.invoice.findFirst({
        where: {
          accountId: account.id,
          closingDate: { gte: monthFrom, lte: monthTo },
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
        remaining,
      };
    }),
  );

  const cardSections = cardSectionResults.filter(
    (section): section is NonNullable<typeof section> => section !== null,
  );

  const balance =
    (cashBalanceAgg._sum.amount?.toNumber() ?? 0) +
    (paidCardBalanceAgg._sum.amount?.toNumber() ?? 0);

  const pendingCardTotal = cardSections
    .filter((section) => !section.isPaid)
    .reduce((sum, section) => sum + section.remaining, 0);

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
    balance,
    paidThisMonth: paidThisMonthAgg._sum.amount?.toNumber() ?? 0,
    pendingCardTotal,
    totalToSettle: balance + pendingCardTotal,
  };
}
