import { getProjects } from "@/lib/data/partners";
import ImpactMap from "./ImpactMap";

export default async function ImpactPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const { v } = await searchParams;
  const projects = await getProjects();
  return <ImpactMap projects={projects} variant={v === "2" ? "density" : "flat"} />;
}
