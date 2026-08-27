// One-off sync for the system category set (Category rows with
// `userId: null`, shared by every user — see prisma/schema.prisma and
// src/lib/default-categories.ts). Unlike `ensureUserSynced`'s guard
// (skips seeding entirely if *any* system category already exists —
// fine for the real login flow, but not what we want here), this checks
// each `DEFAULT_CATEGORIES` entry individually by name: creates whatever
// is missing, and updates type/icon/colorStyle for anything that already
// exists but has drifted from the current defaults (e.g. categories
// created before `colorStyle` was added to the list). Safe to re-run any
// time DEFAULT_CATEGORIES changes — never duplicates, never touches user
// data or demo data (see prisma/seed.ts for that).
//
// Usage (from the project root):
//   npx tsx scripts/seed-categories.ts

import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_CATEGORIES } from "../src/lib/default-categories";

neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const existing = await prisma.category.findMany({
    where: { userId: null },
    select: { id: true, name: true, type: true, icon: true, colorStyle: true },
  });
  const existingByName = new Map(existing.map((c) => [c.name, c]));

  let created = 0;
  let updated = 0;

  for (const category of DEFAULT_CATEGORIES) {
    const current = existingByName.get(category.name);

    if (!current) {
      await prisma.category.create({ data: category });
      created++;
      continue;
    }

    const isStale =
      current.type !== category.type ||
      current.icon !== category.icon ||
      current.colorStyle !== category.colorStyle;

    if (isStale) {
      await prisma.category.update({
        where: { id: current.id },
        data: {
          type: category.type,
          icon: category.icon,
          colorStyle: category.colorStyle,
        },
      });
      updated++;
    }
  }

  const unchanged = DEFAULT_CATEGORIES.length - created - updated;
  console.log(
    `Categorias: ${created} criadas, ${updated} atualizadas, ${unchanged} já em dia.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
