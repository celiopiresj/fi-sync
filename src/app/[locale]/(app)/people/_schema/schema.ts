import { z } from "zod";
import { isValidPersonPhone } from "../_lib/phone";
import { AVAILABLE_COLORS } from "@/components/form/color-picker";

export const personSchema = z.object({
  name: z.string().min(1),
  // One combined field (country code + number together, e.g.
  // "+55 11 91234-5678") — split into the two stored columns
  // (Person.phoneCountryCode/phone) only at the Prisma write boundary,
  // see `splitPersonPhone` in ../_lib/phone.ts. Optional: like
  // `categoryId`/`cardId` on the transaction schema, "no value" is a
  // plain empty string rather than `.optional()`, since `field.TextField`
  // (src/components/form/text-field.tsx) always reads a `string` from
  // form state, never `string | undefined`.
  phone: z.string(),
  // Same AVAILABLE_COLORS palette as Category/Card's own colorStyle
  // (src/components/form/color-picker.tsx) — optional like Card's own
  // field (emptyPersonFormValues below still defaults it to the
  // palette's first color so the picker always has a selection), a
  // person created before this field existed just falls back to
  // getPersonColorClasses' hash-based color (people/_lib/person-avatar.ts).
  colorStyle: z.string().optional(),
});

export type PersonFormValues = z.input<typeof personSchema>;
export type PersonValues = z.output<typeof personSchema>;

export const emptyPersonFormValues: PersonFormValues = {
  name: "",
  phone: "",
  colorStyle: AVAILABLE_COLORS[0].class,
};

// Validated with libphonenumber-js instead of a regex, since valid
// length/pattern differs per country. Called from both the client
// validator (person-form.tsx) and the Server Action (actions.ts) with the
// same translated message, so the two can't drift — same split as
// `refineTransaction` in the transactions schema.
export function refinePerson(
  data: PersonValues,
  ctx: z.RefinementCtx,
  options: { messages: { invalidPhone: string } },
) {
  if (!data.phone) return;

  if (!isValidPersonPhone(data.phone)) {
    ctx.addIssue({
      code: "custom",
      path: ["phone"],
      message: options.messages.invalidPhone,
    });
  }
}
