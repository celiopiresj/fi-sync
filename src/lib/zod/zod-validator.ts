import * as z from "zod";

// Zod's `issue.path` is a plain array (e.g. ["cards", 0,
// "lastFourDigits"]) — but TanStack Form names array-indexed fields with
// bracket notation (`cards[0].lastFourDigits`, matching every
// `form.AppField name={`cards[${index}].x`}` call in this codebase), not
// dot notation. A naive `path.join(".")` produces "cards.0.lastFourDigits"
// instead, which doesn't match any registered field: the resulting error
// gets attached to a field TanStack Form never reads, so it correctly
// blocks submission (the form as a whole is still invalid) but silently
// shows nothing next to the field that's actually wrong — the button just
// looks like it stopped doing anything. Every top-level or whole-array
// path (["paymentMethod"], ["splits"]) is a single segment and was never
// affected; this only matters once a `ctx.addIssue` targets a specific
// array INDEX, which cards' own lastFourDigits check was the first to do.
function toFieldName(path: (string | number)[]): string {
  return path.reduce<string>((name, segment) => {
    if (typeof segment === "number") return `${name}[${segment}]`;
    return name ? `${name}.${segment}` : segment;
  }, "");
}

export function zodValidator<T extends z.ZodType>(
  schema: T,
  error?: z.core.$ZodErrorMap
) {
  return ({ value }: { value: z.input<T> }) => {
    const result = schema.safeParse(value, { error });
    if (result.success) return undefined;

    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = toFieldName(issue.path as (string | number)[]);
      if (!(path in fields)) fields[path] = issue.message;
    }
    return { fields };
  };
}
