import { getProjects, getOrgsMap } from "@/lib/data/partners";
import ImpactMapClient from "./ImpactMapClient";

export default async function ImpactPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const { v } = await searchParams;
  const [projects, orgs] = await Promise.all([getProjects(), getOrgsMap()]);
  return (
    <main aria-label="CRAF'd Impact Map" style={{ position: "absolute", inset: 0 }}>
      <ImpactMapClient projects={projects} orgs={orgs} variant={v === "2" ? "dark" : v === "d" ? "density" : "flat"} />
    </main>
  );
}
