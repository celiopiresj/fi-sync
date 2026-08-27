import { APP_TIME_ZONE } from "@/lib/date";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import fs from "node:fs";
import path from "node:path";
import { routing } from "./routing";

const MESSAGES_DIR = path.join(process.cwd(), "src/messages");

// One entry per locale, filled in lazily and cached for the life of the
// server process. Dropping/adding a .json file under src/messages/{locale}/
// is picked up automatically — nothing here needs to change.
const cache = new Map<string, Record<string, unknown>>();

function loadMessages(locale: string) {
  const cached = cache.get(locale);
  if (cached && process.env.NODE_ENV === "production") return cached;

  const localeDir = path.join(MESSAGES_DIR, locale);
  const files = fs.readdirSync(localeDir).filter((f) => f.endsWith(".json"));

  const messages = Object.fromEntries(
    files.map((file) => [
      file.replace(/\.json$/, ""), // "scrn-transactions", "common", ...
      JSON.parse(fs.readFileSync(path.join(localeDir, file), "utf-8")),
    ]),
  );

  cache.set(locale, messages);
  return messages;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: loadMessages(locale),
    timeZone: APP_TIME_ZONE,
  };
});
