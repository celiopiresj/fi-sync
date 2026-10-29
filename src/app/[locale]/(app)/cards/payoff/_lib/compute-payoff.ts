import type { PayoffScope } from "../_schema/schema";
import type {
  CardPayoff,
  PayoffInvoiceInput,
  PayoffItem,
  PayoffPerson,
  PayoffTransactionInput,
} from "../_types/types";
import { allocateCents, fromCents } from "./cents";
import { monthKeyOf } from "./payoff-month";

type ComputeCardPayoffInput = {
  // Every unpaid invoice of the cards in scope, any due month.
  invoices: PayoffInvoiceInput[];
  people: PayoffPerson[];
  // "yyyy-MM-dd" in APP_TIME_ZONE.
  todayKey: string;
  scope: PayoffScope;
  // Whose shares to count — everyone's when empty/omitted.
  personIds?: string[];
  fromMonth?: string;
};

// Owner of money nobody is attributed to when the self Person is somehow
// missing — never shown as a person, only kept so the totals still add up.
const UNATTRIBUTED = "__unattributed__";

function addCents(map: Map<string, number>, key: string, cents: number) {
  if (cents === 0) return;
  map.set(key, (map.get(key) ?? 0) + cents);
}

function sumCents(map: Map<string, number>): number {
  let total = 0;
  for (const cents of map.values()) total += cents;
  return total;
}

// What each person owes for one purchase, in positive cents (a refund
// comes out negative). Whatever the splits don't cover is the user's own
// share — a purchase with no splits at all is entirely theirs — same
// rule payInvoice uses when it splits a payment (invoices/actions.ts).
function owedByPerson(
  transaction: PayoffTransactionInput,
  selfId: string,
): Map<string, number> {
  const owed = new Map<string, number>();
  let attributedCents = 0;
  for (const split of transaction.splits) {
    addCents(owed, split.personId, -split.amountCents);
    attributedCents += split.amountCents;
  }
  addCents(owed, selfId, -(transaction.amountCents - attributedCents));
  return owed;
}

// A purchase counts toward paying off the card when it's real debt
// already: every installment (the purchase was made, even if the
// installment itself lands months from now) and — under "all" — any
// other row, including one the user entered with a future date. The
// exception is a recurrence's row dated in the future: that charge
// hasn't been billed yet, so paying the card off today wouldn't cover
// it and it never counts.
function isPayoffDebt(
  transaction: PayoffTransactionInput,
  scope: PayoffScope,
  todayKey: string,
): boolean {
  if (transaction.installmentGroupId !== null) return true;
  if (scope !== "all") return false;
  return transaction.recurrenceId === null || transaction.dateKey <= todayKey;
}

type ResolvedInvoice = {
  invoice: PayoffInvoiceInput;
  monthKey: string;
  rows: { transaction: PayoffTransactionInput; owed: Map<string, number> }[];
  // What each person still owes on this invoice's in-scope rows, after
  // whatever was already paid against it.
  remaining: Map<string, number>;
  // remaining minus the in-scope rows' own gross — the "já pago" line.
  adjustment: Map<string, number>;
};

// Payments are tracked per person (each settlement Transaction carries
// the splits payInvoice gave it), so what a payment already covered is
// subtracted from exactly the people it was for — no invoice-wide
// guess. Within one person, a payment that only partly covered them is
// spread across their in-scope rows in proportion to everything they
// owed on the invoice (it can't be pinned to any one purchase). "Owed"
// there means real debt only (isPayoffDebt under "all"): a payment can't
// have covered a recurring charge that hasn't happened yet, so letting
// one into the base would dilute the payment and overstate what's left.
// An invoice with no payments at all needs none of this: the rows are
// what's owed.
function resolveInvoice(
  invoice: PayoffInvoiceInput,
  scope: PayoffScope,
  todayKey: string,
  selfId: string,
): ResolvedInvoice {
  const wholeOwed = new Map<string, number>();
  const scopedOwed = new Map<string, number>();
  const rows: ResolvedInvoice["rows"] = [];

  for (const transaction of invoice.transactions) {
    if (!isPayoffDebt(transaction, "all", todayKey)) continue;
    const owed = owedByPerson(transaction, selfId);
    for (const [personId, cents] of owed) addCents(wholeOwed, personId, cents);
    if (!isPayoffDebt(transaction, scope, todayKey)) continue;
    for (const [personId, cents] of owed) addCents(scopedOwed, personId, cents);
    rows.push({ transaction, owed });
  }

  const settled = new Map<string, number>();
  for (const split of invoice.paymentSplits) {
    addCents(settled, split.personId, -split.amountCents);
  }
  // Credit carried in from an earlier invoice isn't per person — shared
  // out across whoever still owed something, by how much.
  if (invoice.creditCents > 0) {
    const debtors = [...wholeOwed]
      .map(([personId, cents]) => [personId, cents - (settled.get(personId) ?? 0)] as const)
      .filter(([, cents]) => cents > 0);
    if (debtors.length > 0) {
      const shares = allocateCents(
        invoice.creditCents,
        debtors.map(([, cents]) => cents),
      );
      debtors.forEach(([personId], index) => {
        addCents(settled, personId, shares[index] ?? 0);
      });
    }
  }

  const remaining = new Map<string, number>();
  const adjustment = new Map<string, number>();
  for (const [personId, grossCents] of scopedOwed) {
    const settledCents = settled.get(personId) ?? 0;
    let netCents = grossCents;
    if (settledCents !== 0) {
      const wholeCents = wholeOwed.get(personId) ?? 0;
      const leftCents = Math.max(0, wholeCents - settledCents);
      netCents =
        wholeCents > 0
          ? Math.min(leftCents, Math.round((grossCents * leftCents) / wholeCents))
          : 0;
    }
    addCents(remaining, personId, netCents);
    addCents(adjustment, personId, netCents - grossCents);
  }

  return {
    invoice,
    monthKey: monthKeyOf(invoice.dueDateKey),
    rows,
    remaining,
    adjustment,
  };
}

type ItemAccumulator = {
  key: string;
  description: string;
  cardName: string;
  people: Set<string>;
  isInstallment: boolean;
  firstNumber: number | null;
  lastNumber: number | null;
  installmentCount: number | null;
  remainingCount: number;
  installmentCents: number;
  lastMonth: string;
  cents: number;
};

// How much it takes to pay the cards off: every unpaid invoice due in
// `fromMonth` or later (earlier ones get paid as usual), counting only
// real debt (isPayoffDebt) and minus what was already paid. Scoped to
// the chosen people's shares when `personIds` has any — the whole amount
// otherwise, since paying the card off means paying everyone's part.
export function computeCardPayoff(input: ComputeCardPayoffInput): CardPayoff {
  const selfId = input.people.find((person) => person.isSelf)?.id ?? UNATTRIBUTED;
  const personById = new Map(input.people.map((person) => [person.id, person]));
  const selected = input.personIds?.length ? new Set(input.personIds) : null;
  const isCounted = (personId: string) => selected === null || selected.has(personId);
  const forFilter = (map: Map<string, number>) => {
    let total = 0;
    for (const [personId, cents] of map) {
      if (isCounted(personId)) total += cents;
    }
    return total;
  };

  const resolved = input.invoices.map((invoice) =>
    resolveInvoice(invoice, input.scope, input.todayKey, selfId),
  );

  const owedByMonth = new Map<string, number>();
  for (const invoice of resolved) {
    addCents(owedByMonth, invoice.monthKey, forFilter(invoice.remaining));
  }
  const owedMonths = [...owedByMonth.keys()].sort();
  const firstMonth = owedMonths[0] ?? null;
  const lastMonth = owedMonths[owedMonths.length - 1] ?? null;
  const fromMonth = input.fromMonth ?? firstMonth;

  const groups = new Map<string, ItemAccumulator>();
  const paidItems: PayoffItem[] = [];
  const monthCents = new Map<string, number>();
  const personCents = new Map<string, number>();
  const cardCents = new Map<string, number>();
  const cardNames = new Map<string, string>();
  let selfCents = 0;

  for (const invoice of resolved) {
    if (fromMonth === null || invoice.monthKey < fromMonth) continue;
    const card = invoice.invoice.card;

    for (const { transaction, owed } of invoice.rows) {
      const cents = forFilter(owed);
      if (cents === 0) continue;
      const key = transaction.installmentGroupId ?? transaction.id;
      const group: ItemAccumulator = groups.get(key) ?? {
        key,
        description: transaction.description,
        cardName: card.name,
        people: new Set<string>(),
        isInstallment: transaction.installmentGroupId !== null,
        firstNumber: transaction.installmentNumber,
        lastNumber: transaction.installmentNumber,
        installmentCount: transaction.installmentCount,
        remainingCount: 0,
        installmentCents: cents,
        lastMonth: invoice.monthKey,
        cents: 0,
      };
      group.cents += cents;
      group.remainingCount += 1;
      if (invoice.monthKey > group.lastMonth) group.lastMonth = invoice.monthKey;
      if (transaction.installmentNumber !== null) {
        if (group.firstNumber === null || transaction.installmentNumber < group.firstNumber) {
          group.firstNumber = transaction.installmentNumber;
          group.installmentCents = cents;
        }
        if (group.lastNumber === null || transaction.installmentNumber > group.lastNumber) {
          group.lastNumber = transaction.installmentNumber;
        }
      }
      for (const [personId, personShare] of owed) {
        if (personShare === 0 || !isCounted(personId)) continue;
        const name = personById.get(personId)?.name;
        if (name) group.people.add(name);
      }
      groups.set(key, group);
    }

    const adjustmentCents = forFilter(invoice.adjustment);
    if (adjustmentCents !== 0) {
      paidItems.push({
        key: `paid-${invoice.invoice.id}`,
        kind: "paid",
        description: "",
        cardName: card.name,
        people: [],
        isInstallment: false,
        firstNumber: null,
        lastNumber: null,
        installmentCount: null,
        remainingCount: 0,
        installmentAmount: 0,
        lastMonth: invoice.monthKey,
        total: fromCents(adjustmentCents),
      });
    }

    const remainingCents = forFilter(invoice.remaining);
    addCents(monthCents, invoice.monthKey, remainingCents);
    addCents(cardCents, card.id, remainingCents);
    cardNames.set(card.id, card.name);
    for (const [personId, cents] of invoice.remaining) {
      if (isCounted(personId)) addCents(personCents, personId, cents);
    }
    // Filtered to other people only, none of the total is the user's own.
    if (isCounted(selfId)) {
      selfCents += invoice.remaining.get(selfId) ?? 0;
    }
  }

  const totalCents = sumCents(monthCents);
  const items = [...groups.values()];
  const installmentGroups = items.filter((group) => group.isInstallment);
  const maxMonthCents = Math.max(0, ...monthCents.values());

  const people = [...personCents]
    .map(([personId, cents]) => ({ person: personById.get(personId), cents }))
    .filter(
      (entry): entry is { person: PayoffPerson; cents: number } =>
        entry.person !== undefined,
    )
    .sort((a, b) => b.cents - a.cents);

  return {
    fromMonth,
    firstMonth,
    lastMonth,
    total: fromCents(totalCents),
    selfTotal: fromCents(selfCents),
    othersTotal: fromCents(totalCents - selfCents),
    othersCount: people.filter((entry) => !entry.person.isSelf && entry.cents > 0).length,
    purchasesCount: items.length,
    parcelsCount: installmentGroups.reduce((count, group) => count + group.remainingCount, 0),
    lastParcelMonth:
      installmentGroups.reduce<string | null>(
        (latest, group) => (latest === null || group.lastMonth > latest ? group.lastMonth : latest),
        null,
      ),
    months: [...monthCents]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, cents]) => ({
        monthKey,
        total: fromCents(cents),
        barPercent: maxMonthCents > 0 ? Math.max(0, Math.round((cents / maxMonthCents) * 100)) : 0,
      })),
    people: people.map(({ person, cents }) => ({
      personId: person.id,
      name: person.name,
      isSelf: person.isSelf,
      total: fromCents(cents),
    })),
    cards: [...cardCents]
      .sort(([, a], [, b]) => b - a)
      .map(([cardId, cents]) => ({
        cardId,
        name: cardNames.get(cardId) ?? "",
        total: fromCents(cents),
      })),
    items: [
      ...items
        .sort((a, b) => b.cents - a.cents)
        .map(
          (group): PayoffItem => ({
            key: group.key,
            kind: "purchase",
            description: group.description,
            cardName: group.cardName,
            people: [...group.people],
            isInstallment: group.isInstallment,
            firstNumber: group.firstNumber,
            lastNumber: group.lastNumber,
            installmentCount: group.installmentCount,
            remainingCount: group.remainingCount,
            installmentAmount: fromCents(group.installmentCents),
            lastMonth: group.lastMonth,
            total: fromCents(group.cents),
          }),
        ),
      ...paidItems.sort((a, b) => a.lastMonth.localeCompare(b.lastMonth)),
    ],
  };
}
