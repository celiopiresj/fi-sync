import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Supported locales — every locale must have a matching folder under
  // src/messages/{locale}/ with the same set of .json files.
  locales: ["pt-BR", "en"],
  defaultLocale: "pt-BR",
});
