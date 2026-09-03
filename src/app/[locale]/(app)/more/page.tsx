import { getMoreOverview } from "./actions";
import { MoreView } from "./_components/more-view";

export default async function MorePage() {
  const overview = await getMoreOverview();

  return <MoreView overview={overview} />;
}
