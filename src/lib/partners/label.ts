// src/lib/partners/label.ts
import type { Partner } from "@/types";

export type PartnerLabel = "collaborating" | "project" | "un" | "other";

export function labelPartner(p: Partner): PartnerLabel {
  const conn = (p.crafd_connection ?? "").toLowerCase();

  if (conn.includes("lead project")) return "project";
  if (conn.includes("mou")) return "un";
  if (conn.includes("collaborating") || conn.includes("implementing"))
    return "collaborating";
  return "other";
}

export type HexNodeKind = "partner" | "label" | "center" | "outline";

export type HexNode = {
  id: string;
  kind: HexNodeKind;

  // which group this belongs to (partner/label only)
  label?: PartnerLabel;

  // text displayed (partner name / label text / center text)
  name?: string;

  // label hex extra
  count?: number;

  // geometry in pixels
  x: number;
  y: number;
  r: number;

  // only for partner nodes
  partner?: Partner;
};

const SQRT3 = Math.sqrt(3);

function axialToPixel(q: number, r: number, size: number) {
  return {
    x: size * 1.5 * q,
    y: size * SQRT3 * (r + q / 2),
  };
}

// 6 axial directions (pointy-top)
const DIRS = [
  { dq: 1, dr: 0 },
  { dq: 1, dr: -1 },
  { dq: 0, dr: -1 },
  { dq: -1, dr: 0 },
  { dq: -1, dr: 1 },
  { dq: 0, dr: 1 },
];

type Axial = { q: number; r: number };

function keyAx(a: Axial) {
  return `${a.q},${a.r}`;
}

function addAx(a: Axial, b: Axial): Axial {
  return { q: a.q + b.q, r: a.r + b.r };
}

/**
 * Generate candidate axial OFFSETS in a wedge (sector).
 * Returns offsets relative to (0,0): first ring 1, then ring 2, etc.
 *
 * wedgeDirs are indices into DIRS; choose 2–3 adjacent directions.
 * Example for “grow left-ish” in axial space: [3,4,5]
 */
function generateWedgeOffsets(n: number, wedgeDirs: number[]): Axial[] {
  const out: Axial[] = [];
  let ring = 1;

  // Safety: ensure unique dirs
  const dirs = Array.from(new Set(wedgeDirs));

  while (out.length < n) {
    // For each direction in the wedge, walk 'ring' steps along that ray
    for (const di of dirs) {
      const d = DIRS[di];
      for (let step = 1; step <= ring; step++) {
        out.push({ q: d.dq * step, r: d.dr * step });
        if (out.length >= n) return out;
      }
    }

    // Then fill a little “between rays” by combining adjacent wedge directions
    // (this makes it a blob, not just lines)
    for (let i = 0; i < dirs.length - 1; i++) {
      const d1 = DIRS[dirs[i]];
      const d2 = DIRS[dirs[i + 1]];
      for (let a = 1; a <= ring; a++) {
        for (let b = 1; b <= ring - a + 1; b++) {
          out.push({ q: d1.dq * a + d2.dq * b, r: d1.dr * a + d2.dr * b });
          if (out.length >= n) return out;
        }
      }
    }

    ring++;
  }

  return out;
}

/**
 * Take a stream of OFFSETS (wedge/spiral/etc), shift them to an anchor,
 * and filter out any ABSOLUTE cells in `blockedAbs`.
 *
 * Returns ABSOLUTE axial coords.
 */
function pickPositionsWithBlockFilter(args: {
  anchorAbs: Axial;
  offsets: Axial[];
  blockedAbs: Set<string>;
  needed: number;
}): Axial[] {
  const { anchorAbs, offsets, blockedAbs, needed } = args;
  const chosen: Axial[] = [];
  const seen = new Set<string>();

  for (const off of offsets) {
    const abs = addAx(anchorAbs, off);
    const k = keyAx(abs);
    if (blockedAbs.has(k)) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    chosen.push(abs);
    if (chosen.length >= needed) break;
  }

  return chosen;
}

function labelDisplay(label: PartnerLabel) {
  switch (label) {
    case "collaborating":
      return "COLLABORATING\nPARTNERS";
    case "project":
      return "PROJECT\nPARTNERS";
    case "un":
      return "UN\nPARTNERS";
    case "other":
      return "OTHER";
  }
}

export function buildPartnerHexNodes(
  partners: Partner[],
  size = 80,
): HexNode[] {
  // 1) group partners
  const groups = new Map<PartnerLabel, Partner[]>();
  for (const p of partners) {
    const lab = labelPartner(p);
    const arr = groups.get(lab) ?? [];
    arr.push(p);
    groups.set(lab, arr);
  }

  const nodes: HexNode[] = [];

  // ------------------------------------------------------------
  // REQUIREMENT 1: central 7 outline hexes (center + 6 neighbors)
  // ------------------------------------------------------------
  const centerAxials = [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ];

  centerAxials.forEach((a, i) => {
    const pxy = axialToPixel(a.q, a.r, size);
    nodes.push({
      id: `outline-${i}`,
      kind: "outline",
      x: pxy.x,
      y: pxy.y,
      r: size,
    });
  });

  // ------------------------------------------------------------
  // REQUIREMENT 2: big white CRAF’d hex overlay in the center
  // ------------------------------------------------------------
  nodes.push({
    id: "center-crafd",
    kind: "center",
    name: "CRISIS\nRISK\nANALYTICS\nFUND",
    x: 0,
    y: 0,
    r: size * 2.0,
  });

  // ------------------------------------------------------------
  // REQUIREMENT 3: label hexes must TOUCH the outline cluster
  // Put each label at a fixed axial position adjacent to an outline hex.
  //
  // Each anchor is 1 hex-step away from one of the outline hexes:
  // - collaborating: left side
  // - project: bottom-ish
  // - un: right side
  // - other: right-lower-ish (small cluster)
  // ------------------------------------------------------------
  const labelAnchorAxial: Record<PartnerLabel, { q: number; r: number }> = {
    collaborating: { q: -2, r: 1 }, 
    project:       { q: -1,  r: 2 }, 
    un:            { q: 2,  r: -1 }, 
    other:         { q: 1,  r: -2 }, 
  };

  // ------------------------------------------------------------
  // REQUIREMENT 4: partners grow in a wedge from label, avoiding blocked cells
  // ------------------------------------------------------------

  // Blocked absolute axial cells: hub + also label cells (added per group below)
  const blockedAbs = new Set<string>();

  const hubAbs: Axial[] = [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ];
  hubAbs.forEach((a) => blockedAbs.add(keyAx(a)));
  // Pre-block ALL label anchors so no partner from any group can land on a label hex
  Object.values(labelAnchorAxial).forEach((a) => blockedAbs.add(keyAx(a)));

  const wedgeByLabel: Record<PartnerLabel, number[]> = {
    collaborating: [1, 2, 3, 4, 5], 
    project:       [5, 0, 1], 
    un:            [0, 1, 2], 
    other:         [2, 1, 3], 
  };

  for (const [label, group] of groups.entries()) {
    const anchor = labelAnchorAxial[label]; // ABS axial position for label
    const anchorPx = axialToPixel(anchor.q, anchor.r, size);

    // block label cell so partners can't take it
    blockedAbs.add(keyAx(anchor));

    // label hex
    nodes.push({
      id: `label-${label}`,
      kind: "label",
      label,
      count: group.length,
      name: labelDisplay(label),
      x: anchorPx.x,
      y: anchorPx.y,
      r: size,
    });

    // candidate offsets in a wedge (generate more than needed)
    const candidateOffsets = generateWedgeOffsets(
      group.length * 8 + 50,
      wedgeByLabel[label],
    );

    // choose absolute axial cells, excluding blocked
    const partnerAbsPositions = pickPositionsWithBlockFilter({
      anchorAbs: anchor,
      offsets: candidateOffsets,
      blockedAbs,
      needed: group.length,
    });

    // create partner nodes and block their cells for subsequent groups
    group.forEach((partner, i) => {
      const abs = partnerAbsPositions[i];
      if (!abs) return;

      blockedAbs.add(keyAx(abs));

      const pxy = axialToPixel(abs.q, abs.r, size);

      nodes.push({
        id: `partner-${label}-${i}-${partner.org_short_name ?? "Unknown"}`.replace(
          /\s+/g,
          "-",
        ),
        kind: "partner",
        label,
        name: partner.org_short_name ?? "Unknown",
        x: pxy.x,
        y: pxy.y,
        r: size,
        partner,
      });
    });
  }

  return nodes;
}
// [DONE] 1. all of them need to be connected to my big white hex: craf'd
// 2. there needs to be a mechanism for them not overlapping
// [DONE] 3. where is project partners? I don't see it at all.
// 4. Should I put in the logos already--it will  help identify?
// 5. hover responses for each hex.
// 6. my current data also doesn't show me the actual connection between these across the different partners. will need data joining here?
// 7. the whole thing should be on a canvas, not svg,  so that nothing gets cut off and its explorable.
