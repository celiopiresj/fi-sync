import { getOpenFinanceOverview } from "./actions";
import { OpenFinanceView } from "./_components/open-finance-view";

export default async function OpenFinancePage() {
  const overview = await getOpenFinanceOverview();
  return <OpenFinanceView overview={overview} />;
}
