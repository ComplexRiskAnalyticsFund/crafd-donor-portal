// src/app/partners/page.tsx
export const dynamic = "force-dynamic";

import {
  getPartners,
  getDonors,
  getVizMeta,
  getProjects,
} from "@/lib/data/partners";
import type { CrafdProject } from "@/types";
import { buildPartnerHexNodes } from "@/app/partners/lib/label";
import PartnersVizClient from "./PartnersVizClient";

export default async function PartnersPage() {
  const [partners, donors, meta, projects] = await Promise.all([
    getPartners(),
    getDonors(),
    getVizMeta(),
    getProjects(),
  ]);
  // donors first so their group is processed before UN spreads into adjacent cells
  const nodes = buildPartnerHexNodes([...donors, ...partners], 75);

  const projectsById: Record<string, CrafdProject> = {};
  for (const p of projects) {
    if (p.airtable_id) projectsById[p.airtable_id] = p;
  }

  return (
    <PartnersVizClient
      initialNodes={nodes}
      asOf={meta.as_of}
      projectsById={projectsById}
    />
  );
}
