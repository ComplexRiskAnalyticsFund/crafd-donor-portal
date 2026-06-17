import type { Partner } from "@/types";

export type PartnerLabel =
  | "collaborating"
  | "project"
  | "un"
  | "other"
  | "donor";

function getExcludedOrganizations(): Set<string> {
  const raw = process.env.EXCLUDED_ORGANIZATIONS;
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed);
  } catch {
    // fall back to comma-separated
  }
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

export function labelPartner(p: Partner): PartnerLabel {
  const conn = (p.crafd_connection ?? []).join(" ").toLowerCase();

  // "donor partner" comes from donors.json; keep the check for safety
  if (conn.includes("donor partner")) return "donor";
  // "project lead partner" (new format) or "lead project partner" (old format)
  if (conn.includes("project lead") || conn.includes("lead project"))
    return "project";
  // "mou signatory" (new) or "mou signatory/un partner" (old)
  if (conn.includes("mou")) return "un";
  // "collaborating partner", "implementing partner", "complementary donor, collaborating partner"
  if (conn.includes("collaborating") || conn.includes("implementing"))
    return "collaborating";
  return "other";
}

/**
 * Whether a partner is a UN partner (MoU signatory). This is independent of the
 * primary `labelPartner` group: a partner can be a "project" lead AND a UN
 * partner at the same time, in which case they are placed in the project wedge
 * but still counted/highlighted as part of the UN group.
 */
export function isUnPartner(p: Partner): boolean {
  const conn = (p.crafd_connection ?? []).join(" ").toLowerCase();
  return conn.includes("mou");
}

/**
 * Manual placement swaps, keyed by airtable_id so they survive Airtable data
 * refreshes. Each pair `[a, b]` exchanges the visualization positions of the two
 * partners (they must be in the same group for the swap to take effect).
 */
const POSITION_SWAPS: ReadonlyArray<readonly [string, string]> = [

  // DPPA <-> PRIO
  ["recXzMOIf3S6mlmkO", "recHKayBVNHm8QsXP"],
  // IOM <-> RCCC
  ["recHv6hZ0SCI0cjT8", "recivcR2hSHFfyvT8"],
  // AWSD <-> Inform
  ["recliM1NwnhtY4nY8", "rec1ZtuGgRSwYb1kb"],
  // Carter Center <-> WFP
  ["recvfKNNEYjFKp1Oh", "reciSCrJAGrkoTltl"],
  // WFP <-> Ridgeway
  ["reciSCrJAGrkoTltl", "rec8ogUa6PWpDwXM7"],

];

/** Swap the array positions of configured partner pairs (mutates in place). */
function applyPositionSwaps(group: Partner[]): void {
  for (const [idA, idB] of POSITION_SWAPS) {
    const i = group.findIndex((p) => p.airtable_id === idA);
    const j = group.findIndex((p) => p.airtable_id === idB);
    if (i === -1 || j === -1) continue;
    [group[i], group[j]] = [group[j], group[i]];
  }
}

/**
 * Group placement overrides, keyed by airtable_id.
 * Forces a partner into a specific wedge regardless of their Airtable connection type.
 * Useful when two partners you want to swap are in different groups.
 */
const GROUP_OVERRIDES: Record<string, PartnerLabel> = {
  // WFP is a MoU signatory (UN group) but placed in collaborating to allow swap with Carter Center
  "reciSCrJAGrkoTltl": "collaborating",
};

/**
 * Manual axial-coordinate offsets, keyed by airtable_id.
 * Applied AFTER the group is laid out: the partner keeps its slot in the group
 * order but its axial cell is shifted by {dq, dr}.
 *
 * Use "additional-collaborating" to move the "+N additional partners" hex.
 *
 * Example — move ACLED one step to the right and one step up:
 *   "reclFvEkKR7sCD7l3": { dq: 1, dr: -1 },
 */
const POSITION_OFFSETS: Record<string, { dq: number; dr: number }> = {
    "recrjN0nS3ygzhIKK": { dq: -3, dr: -7 },
      "additional-collaborating": { dq: 4, dr: -14 },

};

/**
 * Apply per-partner axial offsets to placed positions (mutates positionsMap in place).
 * positionsMap: index in group[] → Axial position.
 */
function applyPositionOffsets(
  group: Partner[],
  positions: (Axial | undefined)[],
  blockedAbs: Set<string>,
): void {
  for (let i = 0; i < group.length; i++) {
    const id = group[i].airtable_id;
    if (!id) continue;
    const delta = POSITION_OFFSETS[id];
    if (!delta) continue;
    const orig = positions[i];
    if (!orig) continue;
    const shifted: Axial = { q: orig.q + delta.dq, r: orig.r + delta.dr };
    // Remove old block, add new block
    blockedAbs.delete(keyAx(orig));
    blockedAbs.add(keyAx(shifted));
    positions[i] = shifted;
  }
}

export type HexNodeKind = "partner" | "label" | "center" | "outline" | "additional";

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

  // partner is also a UN partner (MoU signatory), even if placed in another
  // group (e.g. a project lead that also signed the MoU)
  isUn?: boolean;
};

const SQRT3 = Math.sqrt(3);

function axialToPixel(q: number, r: number, size: number) {
  return {
    x: size * 1.5 * q,
    y: size * SQRT3 * (r + q / 2),
  };
}

// 6 axial directions (flat-top)
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
 * Generate axial OFFSETS as vertical columns of a fixed height, where each
 * successive column is placed one step to the RIGHT and one step HIGHER than
 * the previous one (a staircase of columns climbing up-right).
 *
 * - `height`: number of hexes per vertical column (e.g. 3).
 * - Columns are emitted left→right; within a column, cells are emitted top→bottom.
 *
 * Offsets are relative to (0,0). Column index k (0-based):
 *   q = k + 1                  (first column sits one step right of the anchor)
 *   r = (j - k) for j in 0..height-1   (top cell climbs by one row each column)
 */
function generateColumnOffsets(n: number, height: number): Axial[] {
  const out: Axial[] = [];
  for (let k = 0; out.length < n; k++) {
    // build each column bottom→top (larger r is lower on screen)
    for (let j = height - 1; j >= 0; j--) {
      // shifted one column left (q) and one row down (r) from the anchor
      out.push({ q: k, r: j - k + 1 });
      if (out.length >= n) return out;
    }
  }
  return out;
}

/**
 * Generate axial OFFSETS (relative to the UN anchor) for the UN partners
 * cluster as three vertical columns, each one step to the right of the last:
 *
 * - Column 1 (right of the UN hexagon): 4 tall. DCO sits at the top (anchor row)
 *   with the rest running downward (the cells above are taken by donors).
 * - Column 2: 6 tall, its top 3 rows higher than DCO.
 * - Column 3: 7 tall, one column further right and one row higher than column 2.
 *
 * `topR` is the offset row of the column's top cell relative to the anchor
 * (anchor row = 0; DCO row is 0). Cells are emitted top→bottom.
 */
function generateUnColumnOffsets(n: number): Axial[] {
  const out: Axial[] = [];
  const columns: ReadonlyArray<{ q: number; topR: number; height: number }> = [
    { q: 1, topR: 0, height: 4 }, // DCO column
    { q: 2, topR: -3, height: 6 }, // 3 higher than DCO
    { q: 3, topR: -5, height: 7 }, // one right + two higher than column 2
  ];

  for (const col of columns) {
    for (let j = 0; j < col.height && out.length < n; j++) {
      out.push({ q: col.q, r: col.topR + j });
    }
  }

  // Defensive: if there are ever more UN partners than the 17 these columns
  // hold, keep extending the staircase (7-tall columns climbing up-right).
  for (let k = 3; out.length < n; k++) {
    const topR = -4 - (k - 2);
    for (let j = 0; j < 7 && out.length < n; j++) {
      out.push({ q: k + 1, r: topR + j });
    }
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
    case "donor":
      return "DONOR\nPARTNERS";
  }
}

export function buildPartnerHexNodes(
  partners: Partner[],
  size = 80,
): HexNode[] {
  // 1) filter, deduplicate, then group partners
  const excludedOrgs = getExcludedOrganizations();
  let excludedCount = 0;
  const dedupedPartners: Partner[] = [];
  const seenNames = new Map<string, number>();
  for (const p of partners) {
    const rawConn = (p.crafd_connection ?? []).join(" ").replace(/[‘’]/g, "’");
    if (rawConn.toLowerCase().includes("craf’d")) continue;
    if (
      /mptfo/i.test(p.org_short_name ?? "") ||
      /mptfo/i.test(p.org_full_name ?? "")
    )
      continue;
    if (rawConn.toLowerCase().includes("administrative agent")) continue;
    if (excludedOrgs.has(p.org_full_name ?? "")) {
      excludedCount++;
      continue;
    }

    const key = (p.org_short_name?.trim() ?? "").toLowerCase();
    if (key && seenNames.has(key)) {
      const idx = seenNames.get(key)!;
      const existing = dedupedPartners[idx];
      const merged = [
        ...new Set([
          ...(existing.relational_project ?? []),
          ...(p.relational_project ?? []),
        ]),
      ];
      dedupedPartners[idx] = { ...existing, relational_project: merged };
    } else {
      if (key) seenNames.set(key, dedupedPartners.length);
      dedupedPartners.push(p);
    }
  }

  const groups = new Map<PartnerLabel, Partner[]>();
  // Count UN partners (MoU signatories) that are placed in a different group
  // (e.g. project leads who also signed the MoU). These are still UN partners
  // and must be reflected in the UN partners count.
  let dualUnCount = 0;
  for (const p of dedupedPartners) {
    const isActionAid =
      /action\s*aid/i.test(p.org_short_name ?? "") ||
      /action\s*aid/i.test(p.org_full_name ?? "");
    const posLabel: PartnerLabel = isActionAid
      ? "collaborating"
      : (GROUP_OVERRIDES[p.airtable_id ?? ""] ?? labelPartner(p));
    if (posLabel !== "un" && isUnPartner(p)) dualUnCount++;
    const arr = groups.get(posLabel) ?? [];
    arr.push(p);
    groups.set(posLabel, arr);
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
  const labelAnchorAxial: Partial<
    Record<PartnerLabel, { q: number; r: number }>
  > = {
    collaborating: { q: -2, r: 1 },
    project: { q: -1, r: 2 },
    un: { q: 2, r: -1 },
    donor: { q: 1, r: -2 },
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

  const wedgeByLabel: Partial<Record<PartnerLabel, number[]>> = {
    collaborating: [1, 2, 3, 4, 5],
    project: [5, 0, 1],
    un: [0, 1, 2],
    donor: [0, 1, 2, 3],
  };

  for (const [label, group] of groups.entries()) {
    const anchor = labelAnchorAxial[label];
    // "other" has no anchor/wedge by design — those partners are intentionally not placed
    if (!anchor) continue;
    const anchorPx = axialToPixel(anchor.q, anchor.r, size);

    // block label cell so partners can't take it
    blockedAbs.add(keyAx(anchor));

    // compute actual positions BEFORE pushing the label so count is honest
    const wedgeDirs = wedgeByLabel[label];
    if (!wedgeDirs) continue;
    // Project partners use vertical columns of 4 that step up-and-right;
    // UN partners use a custom column staircase (DCO column of 4, then columns
    // of 6 starting 3 higher); all other groups keep the wedge/blob growth.
    const candidateOffsets =
      label === "project"
        ? generateColumnOffsets(group.length * 4 + 50, 4)
        : label === "un"
          ? generateUnColumnOffsets(group.length + 10)
          : generateWedgeOffsets(group.length * 8 + 50, wedgeDirs);
    const partnerAbsPositions = pickPositionsWithBlockFilter({
      anchorAbs: anchor,
      offsets: candidateOffsets,
      blockedAbs,
      needed: group.length,
    });

    // label hex — count = partners actually placed, not total in group
    const rawCount =
      partnerAbsPositions.length +
      (label === "collaborating" ? excludedCount : 0) +
      // UN partners placed in other groups (e.g. project leads who also signed
      // the MoU) still count towards the UN partners total.
      (label === "un" ? dualUnCount : 0);
    const displayCount =
      label === "collaborating"
        ? Math.floor(rawCount / 10) * 10
        : rawCount;
    nodes.push({
      id: `label-${label}`,
      kind: "label",
      label,
      count: displayCount,
      name: labelDisplay(label),
      x: anchorPx.x,
      y: anchorPx.y,
      r: size,
    });

    // logo partners first → inner positions; no-logo partners → outskirts
    group.sort((a, b) => {
      const hasLogo = (p: Partner) => !!p.logo_slug;
      return Number(hasLogo(b)) - Number(hasLogo(a));
    });

    // Manual position swaps within a group, keyed by airtable_id so they survive
    // Airtable data refreshes (which would revert any edits to partners.json).
    // Each pair swaps the two partners' placement positions in the visualization.
    applyPositionSwaps(group);

    // Manual axial offsets — shift individual partners after layout.
    // Mutable copy so offsets can move cells independently of the candidate list.
    const placedPositions: (Axial | undefined)[] = [...partnerAbsPositions];
    applyPositionOffsets(group, placedPositions, blockedAbs);

    // create partner nodes and block their cells for subsequent groups
    group.forEach((partner, i) => {
      const abs = placedPositions[i];
      if (!abs) return;

      blockedAbs.add(keyAx(abs));

      const pxy = axialToPixel(abs.q, abs.r, size);

      const displayName =
        partner.org_short_name?.trim() ||
        partner.org_full_name?.trim() ||
        "Unknown";
      nodes.push({
        id: `partner-${label}-${i}-${displayName}`.replace(/\s+/g, "-"),
        kind: "partner",
        // Use the partner's actual connection label (not the position-override label)
        // so styling, hover, and label-hex highlights remain data-accurate.
        label: labelPartner(partner),
        name: displayName,
        x: pxy.x,
        y: pxy.y,
        r: size,
        partner,
        isUn: isUnPartner(partner),
      });
    });

    // For the collaborating group, add a placeholder hex for excluded orgs
    if (label === "collaborating" && excludedCount > 0) {
      const extraPositions = pickPositionsWithBlockFilter({
        anchorAbs: anchor,
        offsets: candidateOffsets,
        blockedAbs,
        needed: 1,
      });
      if (extraPositions[0]) {
        const additionalDelta = POSITION_OFFSETS["additional-collaborating"];
        const abs = additionalDelta
          ? { q: extraPositions[0].q + additionalDelta.dq, r: extraPositions[0].r + additionalDelta.dr }
          : extraPositions[0];
        blockedAbs.add(keyAx(abs));
        const pxy = axialToPixel(abs.q, abs.r, size);
        nodes.push({
          id: "additional-collaborating",
          kind: "additional",
          label: "collaborating",
          count: excludedCount,
          name: "ADDITIONAL\nCOLLABORATING\nPARTNERS",
          x: pxy.x,
          y: pxy.y,
          r: size,
        });
      }
    }
  }

  return nodes;
}
