import { listCreditCardAccounts } from "./actions";
import { CardsView } from "./_components/cards-view";

export default async function CardsPage() {
  const accounts = await listCreditCardAccounts();

  return <CardsView initialAccounts={accounts} />;
}
