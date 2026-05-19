import type { HexNode } from "@/app/partners/lib/label";
import type { CrafdProject } from "@/types";

export const SQRT3 = Math.sqrt(3);
export const HEX_SIZE = 75;
export const GRID_LIMIT = 2400;
export const MIN_SCALE = 0.4;
export const MAX_SCALE = 3.5;

export function clampPan(x: number, y: number, s: number) {
  const maxX = Math.max(0, GRID_LIMIT * s - 900);
  const maxY = Math.max(0, GRID_LIMIT * s - 500);
  return {
    x: Math.max(-maxX, Math.min(maxX, x)),
    y: Math.max(-maxY, Math.min(maxY, y)),
  };
}

export function toLogoSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[ /_]/g, "-")
    .replace(/[&(),]/g, "");
}

export function hexPathFlat(cx: number, cy: number, r: number) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  return `M ${pts.map((p) => p.join(",")).join(" L ")} Z`;
}

export function fillFor(n: HexNode, highlighted = false) {
  if (n.kind === "center") return "white";
  if (n.kind === "label") return "#FFD89C";
  if (n.kind === "outline") return "none";
  if (n.kind === "partner" && n.label === "donor") return "white";
  if (highlighted) return "#000000";
  return "#1C1C1C";
}

export function strokeFor(n: HexNode): string {
  if (n.kind === "partner" && n.label === "donor")
    return "var(--color-crafd-yellow)";
  return "white";
}

export function strokeWidthFor(n: HexNode) {
  if (n.kind === "center") return 0;
  return 2;
}

const _parseCache = new Map<string, Set<string>>();
const _arrayCache = new WeakMap<readonly string[], Set<string>>();
const _emptySet: Set<string> = new Set();

export function parseProjects(
  rp: string[] | string | undefined | null,
): Set<string> {
  if (!rp) return _emptySet;
  if (Array.isArray(rp)) {
    if (rp.length === 0) return _emptySet;
    let cached = _arrayCache.get(rp);
    if (!cached) {
      cached = new Set(rp);
      _arrayCache.set(rp, cached);
    }
    return cached;
  }
  let cached = _parseCache.get(rp);
  if (!cached) {
    cached = new Set(
      rp
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    _parseCache.set(rp, cached);
  }
  return cached;
}

export function projectsOverlap(
  a: string[] | string | undefined | null,
  b: string[] | string | undefined | null,
): boolean {
  const pa = parseProjects(a);
  if (pa.size === 0) return false;
  for (const p of parseProjects(b)) {
    if (pa.has(p)) return true;
  }
  return false;
}

export function formatGrantSize(
  raw: string | number | null | undefined,
): string {
  if (raw == null || raw === "") return "—";
  const num =
    typeof raw === "number" ? raw : parseFloat(raw.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return String(raw);
  const prefix = "$";
  if (num >= 1_000_000) return `${prefix}${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${prefix}${(num / 1_000).toFixed(0)}K`;
  return `${prefix}${num}`;
}

/**
 * Find the hub (lead) node for a project within a set of candidate nodes.
 * Uses per-project `linked_lead_org` from project data, falling back to
 * the clicked source node, then the first node.
 */
export function findProjectHub(
  projNodes: HexNode[],
  projectData: CrafdProject | undefined,
  lockedSourceNode: HexNode | null,
): HexNode {
  return (
    projNodes.find(
      (n) =>
        n.partner?.airtable_id != null &&
        projectData?.linked_lead_org?.includes(n.partner.airtable_id),
    ) ??
    (lockedSourceNode && projNodes.some((n) => n.id === lockedSourceNode.id)
      ? lockedSourceNode
      : null) ??
    projNodes[0]
  );
}
