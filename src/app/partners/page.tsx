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

  const partnerLogos: Record<string, string> = {};
  const partnerLogoThumbs: Record<string, string> = {};
  try {
    const whiteDir = path.join(process.cwd(), "public", "white_logos");
    for (const f of await fs.readdir(whiteDir)) {
      if (f === "thumb") continue;
      partnerLogos[path.parse(f).name] = `/white_logos/${f}`;
    }
  } catch { /* directory doesn't exist yet */ }
  try {
    const thumbDir = path.join(process.cwd(), "public", "white_logos", "thumb");
    for (const f of await fs.readdir(thumbDir)) {
      partnerLogoThumbs[path.parse(f).name] = `/white_logos/thumb/${f}`;
    }
  } catch { /* directory doesn't exist yet */ }
  try {
    const colorDir = path.join(process.cwd(), "public", "logos", "color");
    for (const f of await fs.readdir(colorDir)) {
      partnerLogos[path.parse(f).name] = `/logos/color/${f}`;
    }
  } catch { /* directory doesn't exist yet */ }

  const projectsByTitle: Record<string, CrafdProject> = {};
  for (const p of projects) {
    if (p.project_short_title) projectsByTitle[p.project_short_title] = p;
  }

  return (
    <div>
      <Suspense fallback={null}>
        <PartnersVizClient
          initialNodes={nodes}
          partnerLogos={partnerLogos}
          partnerLogoThumbs={partnerLogoThumbs}
          asOf={meta.as_of}
          projectsByTitle={projectsByTitle}
        />
      </Suspense>
    </div>
  );
}
