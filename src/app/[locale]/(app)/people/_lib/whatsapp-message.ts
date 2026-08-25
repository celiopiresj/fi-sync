// Pure text/link builders — every label passed in is already translated
// and formatted by the caller (person-detail-view.tsx and people-view.tsx,
// which have useTranslations/useFormatter), so this file has no next-intl
// dependency and stays trivially testable. Lives at this route's parent
// level (not people/[id]) since both the person detail page and the
// people list's "Cobrar" shortcut build the same message.

import { toAppZoned } from "@/lib/date";

export type WhatsAppLine = { label: string; valueLine: string };

export type BuildStatementMessageInput = {
  greeting: string;
  title: string;
  balanceLine: string;
  movementsSectionTitle: string;
  movements: WhatsAppLine[];
  invoiceSectionTitle: string;
  invoiceItems: WhatsAppLine[];
  invoiceTotalLine: string | null;
  totalLine: string;
};

export type GreetingPeriod = "morning" | "afternoon" | "evening";

// Which greeting to open the message with, from APP_TIME_ZONE's
// wall-clock hour (see src/lib/date.ts) — not the server process's own
// timezone, which can already be a different part of the day in UTC.
export function getGreetingPeriod(date: Date): GreetingPeriod {
  const hour = toAppZoned(date).getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

// WhatsApp's own markdown: *bold* wraps section titles/the final total,
// not a "----" separator line — breaks less awkwardly on a narrow phone
// screen. Consolidates every card section's items into this one
// "Fatura" block/total regardless of how many cards contributed (the
// on-screen view keeps them in separate sections per card — see
// getPersonStatement in actions.ts — but the message is meant to read as
// one flat extract).
export function buildStatementMessage(input: BuildStatementMessageInput): string {
  const blocks: string[] = [
    `${input.greeting}!`,
    "",
    `*${input.title}*`,
    "",
    input.balanceLine,
  ];

  if (input.movements.length > 0) {
    blocks.push("", `*${input.movementsSectionTitle}*`);
    for (const movement of input.movements) {
      blocks.push("", movement.label, movement.valueLine);
    }
  }

  if (input.invoiceItems.length > 0) {
    blocks.push("", `*${input.invoiceSectionTitle}*`);
    for (const item of input.invoiceItems) {
      blocks.push("", item.label, item.valueLine);
    }
    if (input.invoiceTotalLine) {
      blocks.push("", input.invoiceTotalLine);
    }
  }

  blocks.push("", `*${input.totalLine}*`);

  return blocks.join("\n");
}

// phoneCountryCode/phone are already normalized (see people/_lib/phone.ts
// — country code digits + national number digits, no punctuation) but
// the digit-only strip stays as a safety net rather than trusting that
// unconditionally.
export function buildWhatsAppLink(
  phoneCountryCode: string | null,
  phone: string | null,
  text: string,
): string | null {
  if (!phone) return null;
  const digits = `${phoneCountryCode ?? ""}${phone}`.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
