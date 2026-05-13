// src/app/partners/page.tsx
export const dynamic = "force-dynamic";

import fs from "fs/promises";
import path from "path";
import {
  getPartners,
  getDonors,
  getVizMeta,
  getProjects,
} from "@/lib/data/partners";
import type { CrafdProject } from "@/types";
import { buildPartnerHexNodes } from "@/lib/partners/label";
import PartnersVizClient from "./PartnersVizClient";

export default async function PartnersPage() {
  const [partners, donors, meta, projects] = await Promise.all([
    getPartners(),
    getDonors(),
    getVizMeta(),
    getProjects(),
  ]);
  // donors first so their group is processed before UN spreads into adjacent cells
  const nodes = buildPartnerHexNodes(
    [...donors, ...partners],
    75,
    meta.anon_partner_count,
  );

  const [whiteFiles, thumbFiles, colorFiles] = await Promise.all([
    fs.readdir(path.join(process.cwd(), "public", "white_logos")).catch(() => [] as string[]),
    fs.readdir(path.join(process.cwd(), "public", "white_logos", "thumb")).catch(() => [] as string[]),
    fs.readdir(path.join(process.cwd(), "public", "logos", "color")).catch(() => [] as string[]),
  ]);

  const partnerLogos: Record<string, string> = {};
  const partnerLogoThumbs: Record<string, string> = {};

  for (const f of whiteFiles) {
    if (f === "thumb") continue;
    partnerLogos[path.parse(f).name] = `/white_logos/${f}`;
  }
  for (const f of thumbFiles) {
    partnerLogoThumbs[path.parse(f).name] = `/white_logos/thumb/${f}`;
  }
  // color logos intentionally override white_logos entries (used in detail panel)
  for (const f of colorFiles) {
    partnerLogos[path.parse(f).name] = `/logos/color/${f}`;
  }

  const projectsByTitle: Record<string, CrafdProject> = {};
  for (const p of projects) {
    if (p.project_short_title) projectsByTitle[p.project_short_title] = p;
  }

  return (
    <div>
      <PartnersVizClient
        initialNodes={nodes}
        partnerLogos={partnerLogos}
        partnerLogoThumbs={partnerLogoThumbs}
        asOf={meta.as_of}
        projectsByTitle={projectsByTitle}
      />
    </div>
  );
}
