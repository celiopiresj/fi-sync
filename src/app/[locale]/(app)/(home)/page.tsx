import { getHomeOverview } from "./actions";
import { HomeView } from "./_components/home-view";
import { HomeViewMobile } from "./_components/home-view-mobile";

export default async function HomePage() {
  const overview = await getHomeOverview();

  return (
    <>
      <HomeView overview={overview} className="hidden md:flex" />
      <HomeViewMobile overview={overview} className="md:hidden" />
    </>
  );
}
