// zod-error-map.ts
import * as z from "zod";

export const makeErrorMap =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (t: (key: string, values?: any) => string): z.core.$ZodErrorMap =>
  (issue) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const i = issue as any;
    switch (issue.code) {
      case "too_small":
        if (issue.type === "string" || i.origin === "string") {
          return issue.minimum === 1
            ? t("required")
            : t("minLength", { min: Number(issue.minimum) });
        }
        if (issue.type === "number" || i.origin === "number") {
          if (issue.minimum === 0 && !issue.inclusive) {
            return t("invalid"); // .positive()
          }
          return t("min", { min: Number(issue.minimum) });
        }
        break;
      case "too_big":
        if (issue.type === "string" || i.origin === "string") {
          return t("maxLength", { max: Number(issue.maximum) });
        }
        if (issue.type === "number" || i.origin === "number") {
          return t("max", { max: Number(issue.maximum) });
        }
        break;
      case "invalid_format":
        if (i.format === "email" || i.validation === "email") {
          return t("email");
        }
        return t("invalid");
      case "invalid_type":
        if (issue.received === "undefined" || issue.received === "null" || i.input === undefined) {
          return t("required");
        }
        return t("invalid");
    }
    return undefined;
  };
