import { getTelegramStatus } from "./actions";
import { TelegramView } from "./_components/telegram-view";

export default async function TelegramPage() {
  const status = await getTelegramStatus();

  return <TelegramView status={status} />;
}
