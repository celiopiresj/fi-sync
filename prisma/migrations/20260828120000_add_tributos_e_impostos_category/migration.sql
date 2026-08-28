-- One-time backfill: add the new "Tributos e Impostos" system category
-- (see src/lib/default-categories.ts) for every existing user in one
-- shot, same "userId NULL = shared by everyone" rule every other system
-- category already relies on — no per-user copy needed. Guarded against
-- re-running this migration (or against a DB where sync-user.ts/seed.ts
-- already created it some other way) via the WHERE NOT EXISTS check.
INSERT INTO "Category" ("id", "userId", "name", "type", "colorStyle", "icon", "createdAt")
SELECT gen_random_uuid()::text, NULL, 'Tributos e Impostos', 'EXPENSE', 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400', 'Receipt', now()
WHERE NOT EXISTS (
  SELECT 1 FROM "Category" WHERE "userId" IS NULL AND "name" = 'Tributos e Impostos'
);
