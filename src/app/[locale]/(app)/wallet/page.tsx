import { getWalletOverview } from "./actions";
import { WalletView } from "./_components/wallet-view";

export default async function WalletPage() {
  const overview = await getWalletOverview();

  return <WalletView overview={overview} />;
}
