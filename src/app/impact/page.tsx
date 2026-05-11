import { getProjects } from "@/lib/data/partners";
import ImpactMap from "./ImpactMap";

export default async function ImpactPage() {
  const projects = await getProjects();
  return <ImpactMap projects={projects} />;
}
