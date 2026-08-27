import { getProjections } from "./actions";
import { DEFAULT_MONTHS_AHEAD } from "./_constants/constants";
import { ProjectionsView } from "./_components/projections-view";

export default async function ProjectionsPage() {
  const projections = await getProjections(DEFAULT_MONTHS_AHEAD);

  return <ProjectionsView initialProjections={projections} />;
}
