import { getProjects, getOrgsMap } from "@/lib/data/partners";
import ImpactMap from "./ImpactMap";

export default async function ImpactPage() {
  const [projects, orgs] = await Promise.all([getProjects(), getOrgsMap()]);
  return (
    <main aria-label="CRAF'd Impact Map" style={{ position: "absolute", inset: 0 }}>
      <ImpactMap projects={projects} orgs={orgs} />
      <p className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-4 pt-1 text-xs text-white text-center leading-tight font-roboto opacity-70">
        The depiction and use of boundaries, geographic names and related data shown on maps are not
        guaranteed to be error-free, nor do they necessarily imply official endorsement or
        acceptance by the United Nations.
      </p>
    </main>
  );
}
