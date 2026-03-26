// src/app/partners/page.tsx
export const dynamic = "force-dynamic";

import { getPartners } from "@/lib/data/partners";
import { buildPartnerHexNodes } from "@/lib/partners/label";
import PartnersVizClient from "./PartnersVizClient";

export default async function PartnersPage() {
  const partners = await getPartners();
  const nodes = buildPartnerHexNodes(partners, 75);
  return (
    <div className="h-screen w-screen bg-[#FDB53C]">
      <PartnersVizClient initialNodes={nodes} />
    </div>
  );
}

// pseudocode:
// 1.  figure out local test server ✅
// 2.  create a function for filtering the data in the way I want it(or should this be done in python before getting the data?)  ✅
//    A]create 'label' in each element of the json by crafd_connection: collaborating partners = collaborating partners + implementing partners ;Project partners = project lead partner; UN partner = MoU Signatory ✅
// B] compute hex grid and x, y location, radius(common for all) for each partner based on the label and the number of partners in each label. This will be used to position the hexagons in the network diagram.  ✅

// 3.  lay it out on the 'grid'
//    A]  the nodes are the partners(hexagons), the center of each one is text partner.json->element->org_short_name(placeholder, will eventually be org_logo_white displayed as an img/svg) ✅
// 4. do the styling so everything looks the way I want it to:
//  A] remove overlaps ✅
// B] replace spirals with a better layout (force-directed graph) ✅
//  C] Unfolding animation✅
// 6. labels are supposed to be on the edges not the sides
//  5. look into the relational hovers: this can possibly be done with styling too.✅
// 6. look into what data I can highlight with this: colour, size, etc.
// 7. look into the scrollability aspect ✅

// 8. fix the logos instead of the names
// 9. MOBILE VERSION JEEZ
// 10. search button
//  11. click 2: modals with information on a particular partner
//  12. click 1: network togethr with project 
