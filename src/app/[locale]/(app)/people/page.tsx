import { listPeople } from "./actions";
import { PeopleView } from "./_components/people-view";

export default async function PeoplePage() {
  const people = await listPeople();

  return <PeopleView initialPeople={people} />;
}
