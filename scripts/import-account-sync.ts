/* eslint-disable @typescript-eslint/no-explicit-any */
// One-off import of real historical financial data (Aug/2026 onward) from
// AccountSync.xlsx into the database — see import-account-sync-data.json
// (prepared from the spreadsheet, in this same folder) for the actual
// data, and the "Decisions" comment block at the end of this file for a
// summary of every mapping choice that was confirmed in chat before this
// was written.
//
// Usage (from the project root):
//   npx tsx scripts/import-account-sync.ts --dry-run   # preview only
//   npx tsx scripts/import-account-sync.ts             # writes for real
//
// How dry-run works: the whole import runs inside one Prisma interactive
// transaction. In --dry-run mode we throw a sentinel error right after
// the last write to force a rollback — every read/find-or-create/insert
// still executes for real against a live transactional snapshot (so the
// preview numbers are accurate, including "already exists, skipping"),
// it just never commits. Every entity below is resolved by find-or-create
// on its natural key (Account: name+type, Card: name within its account,
// Category: name, Person: name), and every Transaction is skipped if one
// already exists with the same account+date+amount+description — so
// running this twice (even for real) does not duplicate anything.
//
// This file intentionally does NOT import from src/lib/prisma.ts or
// src/lib/invoice-resolution.ts: those pull in the app's own Prisma
// singleton (fine inside Next.js, but this is a standalone script run
// via tsx, same spirit as prisma/seed.ts building its own PrismaClient
// instead of reusing the app's). `computeInvoiceCycle` below is copied
// verbatim from src/lib/invoice-resolution.ts for the same reason.

import "dotenv/config";
import { addMonths, setDate } from "date-fns";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { toAppZoned, fromAppZoned, parseCalendarDate } from "../src/lib/date";
import data from "./import-account-sync-data.json";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes("--dry-run");

type Tx = Prisma.TransactionClient;

// Shape of import-account-sync-data.json, typed explicitly rather than
// relying on `resolveJsonModule`'s inferred literal-union type — this
// script can't be run through `tsc`/the IDE from this sandbox (no
// generated Prisma client here to check against), so an explicit,
// hand-verified shape is safer than trusting inference. Enum-like string
// fields (Account.type, Recurrence.frequency, Transaction.paymentMethod)
// are cast with `as any` at their one use site each below rather than
// imported as real enum types, for the same "can't verify the exact
// generated export names from here" reason — Postgres still enforces the
// real enum constraint at write time, so a mismatched string fails loudly
// instead of corrupting data silently.
interface CardDef {
  key: string;
  name: string;
  lastFourDigits: string | null;
}
interface AccountDef {
  key: string;
  name: string;
  type: "CHECKING" | "CREDIT_CARD";
  limit?: number;
  closingDay?: number;
  dueDay?: number;
  cards?: CardDef[];
}
interface PersonDef {
  key: string;
  name: string;
  phoneCountryCode: string | null;
  phone: string | null;
}
interface RecurrenceDef {
  key: string;
  description: string;
  amount: number;
  accountKey: string;
  cardKey: string | null;
  categoryName: string | null;
  personKey: string;
  startDate: string;
  frequency: "MONTHLY";
}
interface TransactionDef {
  source: string;
  description: string;
  amount: number;
  date: string;
  accountKey: string;
  cardKey: string | null;
  categoryName: string | null;
  personKey: string | null;
  paymentMethod: string | null;
  installment: { groupId: string; number: number; count: number } | null;
  recurrenceKey: string | null;
}
interface ImportData {
  meta: { source: string; cutoffDate: string };
  accounts: AccountDef[];
  categories: string[];
  people: PersonDef[];
  recurrences: RecurrenceDef[];
  transactions: TransactionDef[];
}

const importData = data as ImportData;

// Copied from src/lib/invoice-resolution.ts — see that file for the full
// rationale (pins the closing/due day math to APP_TIME_ZONE so it can't
// land on the wrong side of the boundary depending on server timezone).
function computeInvoiceCycle(fromDate: Date, cardDetails: { closingDay: number; dueDay: number }) {
  const zonedFrom = toAppZoned(fromDate);
  let closingDate = setDate(zonedFrom, cardDetails.closingDay);
  if (closingDate < zonedFrom) closingDate = addMonths(closingDate, 1);
  let dueDate = setDate(closingDate, cardDetails.dueDay);
  if (dueDate < closingDate) dueDate = addMonths(dueDate, 1);
  return { closingDate: fromAppZoned(closingDate), dueDate: fromAppZoned(dueDate) };
}

class DryRunAbort extends Error {}

const stats = {
  accountsCreated: 0,
  accountsFound: 0,
  cardsCreated: 0,
  cardsFound: 0,
  categoriesCreated: 0,
  categoriesFound: 0,
  peopleCreated: 0,
  peopleFound: 0,
  recurrencesCreated: 0,
  recurrencesFound: 0,
  transactionsCreated: 0,
  transactionsSkippedExisting: 0,
};

async function resolveUserId(tx: Tx): Promise<string> {
  if (process.env.IMPORT_USER_ID) return process.env.IMPORT_USER_ID;
  const users = await tx.user.findMany({ select: { id: true, createdAt: true } });
  if (users.length === 1) return users[0].id;
  console.error(`Found ${users.length} users in the database — set IMPORT_USER_ID to say which one:`);
  for (const u of users) console.error(`  ${u.id}  (created ${u.createdAt.toISOString()})`);
  throw new Error("Cannot determine which user to import for");
}

async function run(tx: Tx) {
  const userId = await resolveUserId(tx);
  console.log(`Importing for user ${userId}${DRY_RUN ? "  [DRY RUN]" : ""}\n`);

  const accountIds = new Map<string, string>();
  const cardIds = new Map<string, string>();
  const categoryIds = new Map<string, string>();
  const personIds = new Map<string, string>();
  const recurrenceIds = new Map<string, string>();
  // accountKey -> {closingDay, dueDay}, needed to resolve invoices for
  // card transactions further down.
  const cardCycle = new Map<string, { closingDay: number; dueDay: number }>();

  // --- Accounts + CreditCardDetails + Cards ---
  for (const a of importData.accounts) {
    let account = await tx.account.findFirst({ where: { userId, name: a.name, type: a.type as any } });
    if (account) {
      stats.accountsFound++;
    } else {
      account = await tx.account.create({ data: { userId, name: a.name, type: a.type as any, currency: "BRL" } });
      stats.accountsCreated++;
    }
    accountIds.set(a.key, account.id);

    if (a.type === "CREDIT_CARD") {
      const closingDay = a.closingDay!;
      const dueDay = a.dueDay!;
      cardCycle.set(a.key, { closingDay, dueDay });
      const existingDetails = await tx.creditCardDetails.findUnique({ where: { accountId: account.id } });
      if (!existingDetails) {
        await tx.creditCardDetails.create({
          data: { accountId: account.id, limit: a.limit!, closingDay, dueDay },
        });
      }
      for (const c of a.cards!) {
        let card = await tx.card.findFirst({ where: { accountId: account.id, name: c.name } });
        if (card) {
          stats.cardsFound++;
        } else {
          card = await tx.card.create({ data: { accountId: account.id, name: c.name, lastFourDigits: c.lastFourDigits } });
          stats.cardsCreated++;
        }
        cardIds.set(c.key, card.id);
      }
    }
  }

  // --- Categories (reuse a system default or the user's own existing
  // category with the same name, case-insensitive, before creating one) ---
  for (const name of importData.categories) {
    let category = await tx.category.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, OR: [{ userId: null }, { userId }] },
    });
    if (category) {
      stats.categoriesFound++;
    } else {
      category = await tx.category.create({ data: { userId, name } });
      stats.categoriesCreated++;
    }
    categoryIds.set(name, category.id);
  }

  // --- People ---
  for (const p of importData.people) {
    let person = await tx.person.findFirst({ where: { userId, name: { equals: p.name, mode: "insensitive" } } });
    if (person) {
      stats.peopleFound++;
    } else {
      person = await tx.person.create({
        data: { userId, name: p.name, phoneCountryCode: p.phoneCountryCode, phone: p.phone },
      });
      stats.peopleCreated++;
    }
    personIds.set(p.key, person.id);
  }

  // --- Recurrences + RecurrenceSplit (single-person: the source data
  // never splits one recurrence across several people) ---
  for (const r of importData.recurrences) {
    const accountId = accountIds.get(r.accountKey)!;
    const personId = personIds.get(r.personKey)!;

    const existingRecurrence = await tx.recurrence.findFirst({
      where: { userId, accountId, description: r.description, amount: r.amount, splits: { some: { personId } } },
    });
    if (existingRecurrence) {
      recurrenceIds.set(r.key, existingRecurrence.id);
      stats.recurrencesFound++;
      continue; // re-run: keep whatever occurrences/edits already exist, don't recreate the template
    }

    const recurrence = await tx.recurrence.create({
      data: {
        userId,
        accountId,
        categoryId: r.categoryName ? categoryIds.get(r.categoryName) : null,
        cardId: r.cardKey ? cardIds.get(r.cardKey) : null,
        description: r.description,
        amount: r.amount,
        frequency: r.frequency as any,
        startDate: parseCalendarDate(r.startDate),
        endDate: null,
        splits: { create: [{ personId, amount: r.amount }] },
      },
    });
    recurrenceIds.set(r.key, recurrence.id);
    stats.recurrencesCreated++;
  }

  // --- Transactions ---
  // Sequential on purpose: resolveInvoiceId below is NOT safe to run
  // concurrently for the same account (see src/lib/invoice-resolution.ts)
  // — two dates in the same billing cycle could both see "no existing
  // invoice" and both try to create one, tripping Invoice's
  // @@unique([accountId, closingDate]). A plain for-loop, one at a time.
  const invoiceCache = new Map<string, string>(); // `${accountId}|${closingDateISO}` -> invoiceId

  async function resolveInvoiceId(accountId: string, purchaseDate: Date, cycle: { closingDay: number; dueDay: number }) {
    const { closingDate, dueDate } = computeInvoiceCycle(purchaseDate, cycle);
    const cacheKey = `${accountId}|${closingDate.toISOString()}`;
    const cached = invoiceCache.get(cacheKey);
    if (cached) return cached;

    const existing = await tx.invoice.findFirst({
      where: { accountId, closingDate: { gte: purchaseDate } },
      orderBy: { closingDate: "asc" },
    });
    const invoice = existing ?? (await tx.invoice.create({ data: { accountId, closingDate, dueDate, status: "OPEN" } }));
    invoiceCache.set(cacheKey, invoice.id);
    return invoice.id;
  }

  let recordIndex = 0;
  for (const t of importData.transactions) {
    recordIndex++;
    if (!t.personKey) throw new Error(`Transaction ${t.source} has no personKey — the JSON should never produce this`);
    const accountId = accountIds.get(t.accountKey)!;
    const personId = personIds.get(t.personKey)!;
    const date = parseCalendarDate(t.date);

    // Wrapped in try/catch purely for diagnostics: on any failure we log
    // which record (position + source id) was being processed before
    // re-throwing, so a crash points at a specific row instead of a bare
    // stack trace. Behavior is unchanged — this still aborts the whole
    // import on the first error, same as before.
    try {
      // personId is part of the dedup key on purpose, not just
      // account+date+amount+description: several people's identical R$9
      // Youtube charges (or two people's Netflix landing on the same
      // amount) share every other field on the same day — without personId
      // here, inserting the 2nd row would find the 1st row's split as "the
      // same transaction" and silently skip a real, distinct one.
      const existing = await tx.transaction.findFirst({
        where: { userId, accountId, date, amount: t.amount, description: t.description, splits: { some: { personId } } },
      });
      if (existing) {
        stats.transactionsSkippedExisting++;
        continue;
      }

      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId,
          categoryId: t.categoryName ? categoryIds.get(t.categoryName) : null,
          description: t.description,
          amount: t.amount,
          date,
          paymentMethod: (t.paymentMethod as any) ?? null,
          recurrenceId: t.recurrenceKey ? recurrenceIds.get(t.recurrenceKey) : null,
          installmentGroupId: t.installment?.groupId ?? null,
          installmentNumber: t.installment?.number ?? null,
          installmentCount: t.installment?.count ?? null,
          splits: { create: [{ personId, amount: t.amount }] },
        },
      });
      if (!transaction?.id) {
        throw new Error(`tx.transaction.create() came back without an id for ${t.source}`);
      }

      if (t.cardKey) {
        const cardId = cardIds.get(t.cardKey);
        if (!cardId) throw new Error(`No cardIds entry for cardKey "${t.cardKey}" (transaction ${t.source})`);
        await tx.transactionCard.create({ data: { transactionId: transaction.id, cardId } });
        const cycle = cardCycle.get(t.accountKey)!;
        const invoiceId = await resolveInvoiceId(accountId, date, cycle);
        await tx.transactionInvoice.create({ data: { transactionId: transaction.id, invoiceId } });
      }

      stats.transactionsCreated++;
      if (recordIndex % 50 === 0) {
        console.log(`  ...${recordIndex}/${importData.transactions.length} transactions processed`);
      }
    } catch (err) {
      console.error(
        `\nFailed on transaction #${recordIndex}/${importData.transactions.length}: source=${t.source} date=${t.date} amount=${t.amount} desc="${t.description}" cardKey=${t.cardKey ?? "null"}`,
      );
      throw err;
    }
  }
}

async function main() {
  try {
    await prisma.$transaction(
      async (tx) => {
        await run(tx);
        if (DRY_RUN) throw new DryRunAbort();
      },
      { timeout: 600_000, maxWait: 20_000 },
    );
  } catch (err) {
    if (!(err instanceof DryRunAbort)) throw err;
  }

  console.log(JSON.stringify(stats, null, 2));
  if (DRY_RUN) {
    console.log("\nDRY RUN — nothing was written (transaction rolled back on purpose).");
    console.log("Re-run without --dry-run to actually import.");
  } else {
    console.log("\nDone.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// -----------------------------------------------------------------------
// Decisions (confirmed in chat before this script was written)
// -----------------------------------------------------------------------
// - Scope: only data belonging to Aug/2026 onward. For card purchases
//   "belongs to" = invoice due date (DataVencimento), not the purchase
//   date — a late-July purchase billed into the August invoice is
//   included, dated on its real purchase day (can be a few weeks before
//   the cutoff; that's expected credit-card behavior, not a bug).
// - "Fatura X YYYY-MM" checking-account settlement rows: not imported at
//   all — only the underlying card purchases are (on the card account).
// - "Débito"-tagged recurrences (MedCenter, Internet, Curso de Inglês):
//   created directly on the Nubank checking account, no card.
// - "C&A" card: excluded entirely (not used).
// - C6 purchases: Alexandre's own card, Rogério's on the Virtual card,
//   everyone else (including Yasmin) on the Titular card. Every other
//   card account has just one Titular card.
// - "Pai Pago" kept as a Person separate from "Pai" (same real person,
//   kept apart on purpose so the amounts don't mix).
// - "Meu" -> Person "Eu".
// - Nubank and Will each have a checking Account and a CREDIT_CARD
//   Account with the identical name — distinguished by `type`.
// - MedCenter's duplicate recurrence tracking (once via Movimentacao's
//   own "Mensal" tag, once via MovimentacaoCartao/RepetirMovimentacao)
//   collapses to one: the Movimentacao-side tag's only occurrence
//   (2026-07-07) is before the cutoff, so it's dropped by the general
//   "needs at least one in-scope occurrence" rule with no special case
//   needed.
// - Recurrence template content (amount/category/card/person) comes from
//   each group's MOST RECENT occurrence, not its first — subscriptions
//   drift (price increases, the person paying changes) and the template
//   should reflect what keeps happening going forward. `startDate` is
//   still the group's true historical first occurrence.
// - "Cópia de Movimentacao" and "Saldo" sheets: not used — the former is
//   a stale pre-2025-07 backup with no id overlap with the live data
//   (and entirely before the cutoff anyway), the latter has no amount
//   column and looks like leftover UI state, not transaction history.
