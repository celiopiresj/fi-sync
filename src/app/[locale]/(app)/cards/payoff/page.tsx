import { getCardPayoff, getCardPayoffOptions } from "./actions";
import { CardPayoffView } from "./_components/card-payoff-view";

export default async function CardPayoffPage() {
  const [options, payoff] = await Promise.all([getCardPayoffOptions(), getCardPayoff()]);

  return <CardPayoffView options={options} initialPayoff={payoff} />;
}
