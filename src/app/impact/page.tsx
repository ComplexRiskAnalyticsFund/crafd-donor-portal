import { getProjects, getOrgsMap } from "@/lib/data/partners";
import ImpactMapClient from "./ImpactMapClient";

export default async function ImpactPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const { v } = await searchParams;
  const [projects, orgs] = await Promise.all([getProjects(), getOrgsMap()]);
  return <ImpactMapClient projects={projects} orgs={orgs} variant={v === "2" ? "dark" : v === "d" ? "density" : "flat"} />;
}
