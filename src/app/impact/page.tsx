import { getProjects, getOrgsMap } from "@/lib/data/partners";
import ImpactMap from "./ImpactMap";

export default async function ImpactPage() {
  const [projects, orgs] = await Promise.all([getProjects(), getOrgsMap()]);
  return (
    <main aria-label="CRAF'd Impact Map" style={{ position: "absolute", inset: 0 }}>
      <ImpactMap projects={projects} orgs={orgs} />
    </main>
  );
}
