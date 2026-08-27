import { getHomeOverview } from "./actions";
import { HomeView } from "./_components/home-view";

export default async function HomePage() {
  const overview = await getHomeOverview();

  return <HomeView overview={overview} />;
}
