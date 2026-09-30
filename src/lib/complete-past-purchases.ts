import { prisma } from "@/lib/prisma";
import { parseCalendarDate, todayCalendarDate } from "@/lib/date";

// A card purchase only stays PENDING while its date is still ahead (a
// recurrence's or installment's future occurrence) — once that day
// arrives the charge has happened, so it flips to COMPLETED on its own,
// the same `date <= today` rule every generation loop already applies
// when it first writes a row. Nothing else ever revisits the status
// after creation, so without this a recurring card charge (e.g. a
// monthly subscription) stayed "Pendente" forever.
//
// Card accounts only: on a debit account a past-dated PENDING row can
// genuinely mean "bill not paid yet", which only the user can confirm.
// A single idempotent updateMany — cheap enough to run on every entry
// into the app ((app) layout) and before listing transactions.
export async function completePastPendingCardPurchases(userId: string) {
  await prisma.transaction.updateMany({
    where: {
      userId,
      status: "PENDING",
      date: { lte: parseCalendarDate(todayCalendarDate()) },
      account: { type: "CREDIT_CARD" },
    },
    data: { status: "COMPLETED" },
  });
}
