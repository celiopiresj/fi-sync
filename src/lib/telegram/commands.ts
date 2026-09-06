// The bot's command menu — the list Telegram shows behind the "/" button
// in the chat, and the same set `resolveReply` (src/app/api/telegram/route.ts)
// actually handles.
//
// Kept here rather than typed into BotFather so the menu can't drift from
// the code: adding a command means adding a branch in `resolveReply` and
// an entry here, then pushing the list with
// `npx tsx scripts/set-telegram-commands.ts`. The /ajuda reply is built
// from this same array (see persona.ts), so it can't fall out of date
// either.
//
// Telegram's constraints on each entry: `command` is 1-32 chars, lowercase
// letters, digits and underscore only, with no leading slash;
// `description` is 1-256 chars.
//
// Every name here is Portuguese on purpose. Two English aliases are still
// HANDLED by the route but deliberately kept OUT of this list:
//
// - `/start` — Telegram itself sends this one, and only this one, when
//   someone taps the Start button on a bot they have not used before. It
//   cannot be renamed or translated: the button is part of Telegram's own
//   UI, not the bot's. So the route keeps answering it, `/iniciar` below
//   is the Portuguese name a user can actually type, and both do exactly
//   the same thing.
// - `/help` — muscle memory from other bots; `/ajuda` is the real one.
//
// Listing either would put a second row in the "/" popup that does the
// same thing as a row already there.
export type TelegramCommand = {
  command: string;
  description: string;
};

export const TELEGRAM_COMMANDS: TelegramCommand[] = [
  {
    command: "iniciar",
    description: "Começar e ver como vincular sua conta do Fi-Sync",
  },
  {
    command: "ajuda",
    description: "O que eu sei fazer e como falar comigo",
  },
  {
    command: "vincular",
    description: "Vincular esta conversa à sua conta: /vincular SEUCODIGO",
  },
  {
    command: "limpar",
    description: "Esquecer o histórico da nossa conversa",
  },
  {
    command: "desvincular",
    description: "Desvincular esta conversa e apagar o histórico",
  },
];

// The "Comandos: ..." line at the bottom of the /ajuda reply. Skips
// `iniciar`: anyone reading /ajuda has already started the bot.
export const TELEGRAM_COMMANDS_LINE = `Comandos: ${TELEGRAM_COMMANDS.filter(
  (entry) => entry.command !== "iniciar",
)
  .map((entry) => `/${entry.command}`)
  .join(", ")}`;
