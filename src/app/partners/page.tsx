// src/app/partners/page.tsx
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import fs from "fs/promises";
import path from "path";
import { getPartners, getDonors, getVizMeta, getProjects } from "@/lib/data/partners";
import type { CrafdProject } from "@/types";
import { buildPartnerHexNodes } from "@/lib/partners/label";
import PartnersVizClient from "./PartnersVizClient";

export default async function PartnersPage() {
  const [partners, donors, meta, projects] = await Promise.all([
    getPartners(), getDonors(), getVizMeta(), getProjects(),
  ]);
  // donors first so their group is processed before UN spreads into adjacent cells
  const nodes = buildPartnerHexNodes([...donors, ...partners], 75, meta.anon_partner_count);

  // Build the set of logo slugs that actually exist in public/white_logos/
  // so the client can fall back to text for any missing logo.
  let availableSlugs: string[] = [];
  try {
    const logoDir = path.join(process.cwd(), "public", "white_logos");
    const files = await fs.readdir(logoDir);
    availableSlugs = files.map((f) => path.parse(f).name);
  } catch {
    // Directory doesn't exist yet — all hexes will show text
  }

  const projectsByTitle: Record<string, CrafdProject> = {};
  for (const p of projects) {
    if (p.project_short_title) projectsByTitle[p.project_short_title] = p;
  }

  return (
    <div>
      <Suspense fallback={null}>
        <PartnersVizClient
          initialNodes={nodes}
          availableSlugs={availableSlugs}
          asOf={meta.as_of}
          projectsByTitle={projectsByTitle}
        />
      </Suspense>
    </div>
  );
}
