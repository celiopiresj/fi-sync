// Both directions of the Person.phone / Person.phoneCountryCode split meet
// here. The form asks for ONE combined field (e.g. "+55 11 91234-5678" or
// "5511912345678"), but the two halves are stored as separate columns
// (see prisma/schema.prisma) — split/joined only at the Prisma read/write
// boundary (actions.ts), same spirit as the Decimal<->dinero.js convention
// for money. Parsing goes through libphonenumber-js rather than a regex,
// since valid length/pattern differs per country.
import { parsePhoneNumberFromString } from "libphonenumber-js";

// Accepts the combined value with or without a leading "+" — typing one
// every time feels fussy, and libphonenumber-js only needs it to treat the
// string as a full international number rather than a local one.
function parseCombined(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withPlus = trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
  return parsePhoneNumberFromString(withPlus) ?? null;
}

export function isValidPersonPhone(raw: string): boolean {
  return parseCombined(raw)?.isValid() ?? false;
}

// Formats a single combined phone value (the shape the onboarding
// wizard's people step holds locally, before it's ever split into the
// two stored columns) for display — same libphonenumber-js
// formatInternational() joinPersonPhone below uses once
// phoneCountryCode/phone exist as separate columns, exposed here for the
// one place that still only has the combined string.
export function formatCombinedPersonPhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const parsed = parseCombined(trimmed);
  return parsed?.isValid() ? parsed.formatInternational() : trimmed;
}

// DB write boundary: split the one combined field into the two stored
// columns. Falls back to saving the raw text in `phone` with no country
// code when it doesn't parse, rather than rejecting or dropping it —
// `refinePerson` (_schema/schema.ts) is what actually blocks invalid
// values at submit time, this just has to handle whatever reaches it.
export function splitPersonPhone(raw: string): {
  phoneCountryCode: string | null;
  phone: string | null;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { phoneCountryCode: null, phone: null };

  const parsed = parseCombined(trimmed);
  if (parsed) {
    return {
      phoneCountryCode: `+${parsed.countryCallingCode}`,
      phone: parsed.nationalNumber,
    };
  }
  return { phoneCountryCode: null, phone: trimmed };
}

// DB read boundary, the other direction — recombines the two stored
// columns into the one field the edit form (prefill) and the people list
// card (display) both show.
export function joinPersonPhone(
  phoneCountryCode: string | null,
  phone: string | null,
): string | null {
  if (!phone) return null;

  const combined = phoneCountryCode ? `${phoneCountryCode}${phone}` : phone;
  const parsed = phoneCountryCode ? parseCombined(combined) : null;

  if (parsed?.isValid()) return parsed.formatInternational();
  return phoneCountryCode ? `${phoneCountryCode} ${phone}` : phone;
}
