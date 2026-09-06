// Pushes the bot's command menu (src/lib/telegram/commands.ts) to
// Telegram, so the "/" button in the chat lists exactly the commands the
// webhook actually handles. Re-run it any time TELEGRAM_COMMANDS changes
// — setMyCommands replaces the whole list, it doesn't append, so this is
// safe to run repeatedly and never leaves a stale entry behind.
//
// Reads TELEGRAM_BOT_TOKEN from .env, same as the webhook. Touches only
// the bot's own configuration — no database, no user data.
//
// Usage (from the project root):
//   npx tsx scripts/set-telegram-commands.ts

import "dotenv/config";
import { TELEGRAM_COMMANDS } from "../src/lib/telegram/commands";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN não está definido no .env.");
  process.exit(1);
}

async function callBotApi(method: string, body: unknown) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { ok: boolean; description?: string };
  if (!payload.ok) {
    throw new Error(`${method} falhou: ${payload.description ?? response.status}`);
  }
  return payload;
}

async function main() {
  await callBotApi("setMyCommands", { commands: TELEGRAM_COMMANDS });

  console.log("Menu de comandos atualizado:");
  for (const entry of TELEGRAM_COMMANDS) {
    console.log(`  /${entry.command} — ${entry.description}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
