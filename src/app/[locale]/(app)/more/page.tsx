import { getMoreOverview } from "./actions";
import { MoreView } from "./_components/more-view";
import { OpenFinanceLink } from "@/components/nav/open-finance-link";

export default async function MorePage() {
  const overview = await getMoreOverview();

  return <div className="mx-auto flex max-w-350 flex-col gap-6"><MoreView overview={overview} /><OpenFinanceLink /></div>;
}
