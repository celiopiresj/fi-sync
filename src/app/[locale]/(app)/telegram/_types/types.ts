import type { getTelegramStatus } from "../actions";

export type TelegramStatus = Awaited<ReturnType<typeof getTelegramStatus>>;
