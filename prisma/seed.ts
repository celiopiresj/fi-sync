import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { DEFAULT_CATEGORIES } from "../src/lib/default-categories";

neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Identity now lives in Neon Auth, not in public.User (see
// prisma/schema.prisma and src/lib/auth/sync-user.ts) — there's no real
// signed-up user to seed against yet, so this is a fixed placeholder id,
// not something meant to log in.
const SEED_USER_ID = "seed-demo-user";

async function main() {
  const user = await prisma.user.upsert({
    where: { id: SEED_USER_ID },
    update: {},
    create: { id: SEED_USER_ID },
  });

  const checking = await prisma.account.create({
    data: {
      userId: user.id,
      name: "Conta corrente",
      type: "CHECKING",
      currency: "BRL",
    },
  });

  const savings = await prisma.account.create({
    data: {
      userId: user.id,
      name: "Poupança",
      type: "SAVINGS",
      currency: "BRL",
    },
  });

  const pocket = await prisma.account.create({
    data: {
      userId: user.id,
      name: "Caixinha viagem",
      type: "POCKET",
      currency: "BRL",
    },
  });

  const cash = await prisma.account.create({
    data: {
      userId: user.id,
      name: "Dinheiro",
      type: "CASH",
      currency: "BRL",
    },
  });

  // People used to split transactions — "Eu" ("Me") plus a couple of examples.
  const [me, mom, sibling] = await Promise.all([
    prisma.person.create({ data: { userId: user.id, name: "Eu", isSelf: true } }),
    prisma.person.create({ data: { userId: user.id, name: "Mãe" } }),
    prisma.person.create({ data: { userId: user.id, name: "Irmão" } }),
  ]);

  // System categories now live in src/lib/default-categories.ts, shared
  // with the real first-login seeding in src/lib/auth/sync-user.ts — used
  // as-is so the demo data never drifts from what a real user gets.
  // Guarded the same way sync-user.ts is, so re-running this seed against
  // a database where real users have already logged in (and so already
  // got these) tops up the rest of the demo data instead of creating a
  // duplicate global set. Looked up by name rather than kept from the
  // `create` calls, since the "already exist" branch needs the same
  // variables pointed at the pre-existing rows.
  const existingCategories = await prisma.category.findMany({
    where: { userId: null },
  });
  const existingKeys = new Set(
    existingCategories.map((c) => `${c.type}:${c.name}`),
  );
  const missingCategories = DEFAULT_CATEGORIES.filter(
    (def) => !existingKeys.has(`${def.type}:${def.name}`),
  );
  const categories = [
    ...existingCategories,
    ...(await Promise.all(
      missingCategories.map((def) => prisma.category.create({ data: def })),
    )),
  ];
  const food = categories.find((c) => c.name === "Alimentação")!;
  const transport = categories.find((c) => c.name === "Transporte")!;
  const salary = categories.find((c) => c.name === "Salário")!;

  const salaryTx = await prisma.transaction.create({
    data: {
      userId: user.id,
      accountId: checking.id,
      categoryId: salary.id,
      description: "Salário",
      amount: "5000.00",
      date: new Date(),
      status: "COMPLETED",
    },
  });

  // Grocery run split between "Eu" and "Mãe".
  const groceriesTx = await prisma.transaction.create({
    data: {
      userId: user.id,
      accountId: checking.id,
      categoryId: food.id,
      description: "Supermercado",
      amount: "-350.40",
      date: new Date(),
      status: "COMPLETED",
    },
  });
  await prisma.transactionSplit.createMany({
    data: [
      { transactionId: groceriesTx.id, personId: me.id, amount: "-175.20" },
      { transactionId: groceriesTx.id, personId: mom.id, amount: "-175.20" },
    ],
  });

  await prisma.transaction.create({
    data: {
      userId: user.id,
      accountId: checking.id,
      categoryId: transport.id,
      description: "Combustível",
      amount: "-180.00",
      date: new Date(),
      status: "PENDING",
    },
  });

  // Transfer example: two linked legs sharing a transferGroupId.
  const transferGroupId = crypto.randomUUID();
  await prisma.transaction.createMany({
    data: [
      {
        userId: user.id,
        accountId: checking.id,
        description: "Transferência para Poupança",
        amount: "-500.00",
        date: new Date(),
        status: "COMPLETED",
        transferGroupId,
      },
      {
        userId: user.id,
        accountId: savings.id,
        description: "Transferência de Conta corrente",
        amount: "500.00",
        date: new Date(),
        status: "COMPLETED",
        transferGroupId,
      },
    ],
  });

  // Recurrence example: rule only, no generated transactions yet (see
  // prisma/schema.prisma comment on Recurrence).
  await prisma.recurrence.create({
    data: {
      userId: user.id,
      accountId: checking.id,
      categoryId: food.id,
      description: "Assinatura streaming",
      amount: "-39.90",
      frequency: "MONTHLY",
      startDate: new Date(),
      // endDate omitted = recurs indefinitely
    },
  });

  // --- Credit card example ---------------------------------------------

  const creditCard = await prisma.account.create({
    data: {
      userId: user.id,
      name: "Cartão Nubank",
      type: "CREDIT_CARD",
      currency: "BRL",
    },
  });

  await prisma.creditCardDetails.create({
    data: {
      accountId: creditCard.id,
      limit: "5000.00",
      closingDay: 5,
      dueDay: 12,
    },
  });

  // Two physical cards on the same account (titular + adicional), sharing
  // the same limit/statement.
  const [titularCard, additionalCard] = await Promise.all([
    prisma.card.create({
      data: { accountId: creditCard.id, name: "Titular", lastFourDigits: "1234" },
    }),
    prisma.card.create({
      data: { accountId: creditCard.id, name: "Adicional — Mãe", lastFourDigits: "5678" },
    }),
  ]);

  // Actual closing/due dates for this cycle — can differ from
  // CreditCardDetails' day-of-month default (weekends/holidays shift it),
  // so they're recorded explicitly here rather than derived.
  const currentInvoice = await prisma.invoice.create({
    data: {
      accountId: creditCard.id,
      closingDate: new Date(new Date().getFullYear(), new Date().getMonth(), 5),
      dueDate: new Date(new Date().getFullYear(), new Date().getMonth(), 12),
      status: "OPEN",
    },
  });
  const nextInvoice = await prisma.invoice.create({
    data: {
      accountId: creditCard.id,
      closingDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5),
      dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 12),
      status: "OPEN",
    },
  });

  // A single-shot purchase on the "Adicional" card, landing in the current
  // invoice — TransactionCard and TransactionInvoice both explicit joins.
  const cardPurchase = await prisma.transaction.create({
    data: {
      userId: user.id,
      accountId: creditCard.id,
      categoryId: food.id,
      description: "Restaurante",
      amount: "-89.90",
      date: new Date(),
      status: "PENDING",
    },
  });
  await prisma.transactionCard.create({
    data: { transactionId: cardPurchase.id, cardId: additionalCard.id },
  });
  await prisma.transactionInvoice.create({
    data: { transactionId: cardPurchase.id, invoiceId: currentInvoice.id },
  });

  // Installment purchase: 2x of R$150 on the "Titular" card — one
  // Transaction row per installment, each holding that installment's own
  // amount, linked by installmentGroupId and to their respective invoice.
  const installmentGroupId = crypto.randomUUID();
  const installment1 = await prisma.transaction.create({
    data: {
      userId: user.id,
      accountId: creditCard.id,
      categoryId: transport.id,
      description: "Passagem aérea (1/2)",
      amount: "-150.00",
      date: new Date(),
      status: "PENDING",
      installmentGroupId,
      installmentNumber: 1,
      installmentCount: 2,
    },
  });
  const installment2 = await prisma.transaction.create({
    data: {
      userId: user.id,
      accountId: creditCard.id,
      categoryId: transport.id,
      description: "Passagem aérea (2/2)",
      amount: "-150.00",
      date: new Date(),
      status: "PENDING",
      installmentGroupId,
      installmentNumber: 2,
      installmentCount: 2,
    },
  });
  await prisma.transactionCard.createMany({
    data: [
      { transactionId: installment1.id, cardId: titularCard.id },
      { transactionId: installment2.id, cardId: titularCard.id },
    ],
  });
  await prisma.transactionInvoice.createMany({
    data: [
      { transactionId: installment1.id, invoiceId: currentInvoice.id },
      { transactionId: installment2.id, invoiceId: nextInvoice.id },
    ],
  });

  console.log("Seed concluído.", {
    salaryTx: salaryTx.id,
    sibling: sibling.id,
    pocket: pocket.id,
    cash: cash.id,
    creditCard: creditCard.id,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
