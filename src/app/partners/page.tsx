// src/app/partners/page.tsx
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import fs from "fs/promises";
import path from "path";
import { getPartners, getDonors } from "@/lib/data/partners";
import { buildPartnerHexNodes } from "@/lib/partners/label";
import PartnersVizClient from "./PartnersVizClient";

export default async function PartnersPage() {
  const [partners, donors] = await Promise.all([getPartners(), getDonors()]);
  const nodes = buildPartnerHexNodes([...partners, ...donors], 75);

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

  return (
    <div className="h-screen w-screen bg-[#FDB53C]">
      <Suspense fallback={null}>
        <PartnersVizClient initialNodes={nodes} availableSlugs={availableSlugs} />
      </Suspense>
    </div>
  );
}
