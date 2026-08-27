-- One-time backfill: mark each user's "Eu" person (created by
-- prisma/seed.ts before Person.isSelf existed) as isSelf. Best-effort
-- only — a user who renamed that Person, or never had one named "Eu",
-- isn't touched here and has to set it from the People screen instead.
-- Ongoing application logic never matches on name again after this.
UPDATE "Person"
SET "isSelf" = true
WHERE "name" = 'Eu';
