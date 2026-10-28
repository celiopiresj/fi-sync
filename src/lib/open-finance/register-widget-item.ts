import { createPluggyClient } from "@/lib/open-finance/pluggy";
import { assertOwnedWidgetItem } from "@/lib/open-finance/widget";
import { savePluggyConnection } from "@/lib/open-finance/connections";
import { OpenFinanceError } from "@/lib/open-finance/schema";

export async function registerPluggyWidgetItem(userId: string, itemId: string, reactivate: boolean) {
  const client = await createPluggyClient();
  const item = await client.item(itemId);
  // Never trust the client callback or webhook payload for ownership.
  // The provider must confirm both the owner reference and connector.
  assertOwnedWidgetItem(item, userId);
  if (item.id !== itemId || item.status === "LOGIN_ERROR" ||
    (item.consentExpiresAt && new Date(item.consentExpiresAt) <= new Date())) throw new OpenFinanceError("provider");
  const accounts = await client.accounts(itemId);
  if (accounts.length === 0) return;
  await savePluggyConnection(userId, itemId, accounts[0].name, accounts, reactivate);
}
