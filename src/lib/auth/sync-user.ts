import { prisma } from "@/lib/prisma";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";

// Neon Auth owns the identity (email, password, OAuth) in the `neon_auth`
// schema — our `public.User` only needs to exist so the rest of the schema
// (Account, Transaction, ...) has something to point `userId` at.
// Call this once we know a session is valid; it's a cheap idempotent
// check-then-create, safe to call on every request from an authenticated
// user (covers both email/password sign-up and first-time OAuth sign-in,
// since neither flow gives us a single reliable "user created" hook to
// call this from otherwise). In practice it's wired into sign-in, sign-up,
// and the OAuth callback, so it runs once per login rather than on every
// request.
//
// Returns `isNewUser` so callers that serve both new and returning users
// through the same code path (the OAuth callback) can redirect a brand-new
// user to /onboarding instead of straight into the dashboard — email/
// password sign-up already knows unconditionally and doesn't need this.
//
// Also where the "coisas iniciais" (starter data) get backfilled — every
// user should land with a starter category set and a self ("Eu") Person
// to attribute their own transactions to, instead of hitting the
// empty-state cold-start UI on day one. Both checks below are idempotent existence
// checks (not gated on the User row being newly created), so this stays
// safe to run on every login and also backfills anyone synced before this
// existed — including via other people's concurrent first login, there's a
// small unguarded race that could double-create either one (and, the same
// way, could race two concurrent requests into both seeing `isNewUser:
// true`); acceptable for how few people use this app, not worth a
// migration/unique constraint for now.
export async function ensureUserSynced(
  userId: string,
): Promise<{ isNewUser: boolean }> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  const isNewUser = !existing;
  if (isNewUser) {
    await prisma.user.create({ data: { id: userId } });
  }

  // Categories with `userId: null` are shared by everyone (see
  // prisma/schema.prisma), so this is a global existence check, not a
  // per-user one — seeded once, the first time anyone logs in after this
  // shipped.
  const hasSystemCategories = await prisma.category.findFirst({
    where: { userId: null },
    select: { id: true },
  });
  if (!hasSystemCategories) {
    await prisma.category.createMany({ data: DEFAULT_CATEGORIES });
  }

  // Person has no shared/global row — always userId-scoped (see
  // prisma/schema.prisma) — so unlike categories this is a per-user
  // check. Every user must have exactly one Person with isSelf: true —
  // it's the permanent "you" the app defaults every person-attribution
  // field to (transactions/actions.ts's computeDefaultPersonId and its
  // recurrences/actions.ts twin) and can't be reassigned from the UI
  // (see people/actions.ts — there's deliberately no setSelfPerson
  // anymore), so it has to exist from the very first login, not be
  // something the user sets up themselves.
  const hasSelfPerson = await prisma.person.findFirst({
    where: { userId, isSelf: true },
    select: { id: true },
  });
  if (!hasSelfPerson) {
    // Upgrades a pre-existing "Meu" row (created by an older version of
    // this same seed, before isSelf existed) instead of creating a
    // second Person, so someone who logged in before this shipped still
    // ends up with exactly one self Person, not two.
    const legacyMeuPerson = await prisma.person.findFirst({
      where: { userId, name: "Meu" },
      select: { id: true },
    });
    if (legacyMeuPerson) {
      await prisma.person.update({
        where: { id: legacyMeuPerson.id },
        data: { name: "Eu", isSelf: true },
      });
    } else {
      await prisma.person.create({ data: { userId, name: "Eu", isSelf: true } });
    }
  }

  return { isNewUser };
}
