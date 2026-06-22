"use client";

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CrafdProject } from "@/types";
import { coverageToRegions } from "./coverage-map";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "./impact-map.module.css";

// ── Types ─────────────────────────────────────────────────
interface HexTile { x: number; y: number; col: number; row: number }
interface TileData { width: number; height: number; hexRadius: number; tilesByRegion: Record<string, HexTile[]> }
interface Props { projects: CrafdProject[]; orgs: Record<string, string> }

// ── Static data ───────────────────────────────────────────
const PROJECT_CATEGORIES: Record<string, string> = {
  "Hazard Modeling":                          "Crisis Anticipation & Warning",
  "GEOGUARD":                                 "Crisis Anticipation & Warning",
  "INFORM Warning":                           "Crisis Anticipation & Warning",
  "eEARTH":                                   "Crisis Anticipation & Warning",
  "CLIFDEW-GRID":                             "Crisis Anticipation & Warning",
  "Maintaining ACLED":                        "Conflict & Peace",
  "ACLED Data":                               "Conflict & Peace",
  "Women's Mobilization Within Armed Groups": "Conflict & Peace",
  "VIEWS-PIN":                                "Conflict & Peace",
  "EMPOW":                                    "Conflict & Peace",
  "Kente Threads":                            "Displacement",
  "Internal Displacement Data":               "Displacement",
  "Conflict Climate Displacement":            "Crisis Anticipation & Warning",
  "PRIMARI":                                  "Displacement",
  "Transformative Outcomes":                  "Needs & Impact",
  "GUARD":                                    "Needs & Impact",
  "Rapid Assessment Data":                    "Needs & Impact",
  "Risk DataHub":                             "Ecosystem Backbone",
  "Strengthening CRAF'd Ecosystem":           "Ecosystem Backbone",
};

const ORG_NAME_MAP: Record<string, string> = {
  "ICPAC": "IGAD",
  "ICG": "Int. Crisis Group",
  "RCCC": "Red Cross Climate Center",
};

const VALID_CATEGORIES = [
  "Crisis Anticipation & Warning",
  "Conflict & Peace",
  "Displacement",
  "Needs & Impact",
  "Ecosystem Backbone",
];

const EXCLUDED_PROJECTS = new Set([
  "CRAF'd Direct Costs",
  "CRAF'd Sec.Direct Cost 2022",
  "MPTFO Admin (1%)",
]);

// ── Module-level stable JSX ───────────────────────────────
const ARROW_ICON = (
  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true" style={{ flexShrink: 0, opacity: 0.5 }}>
    <path d="M2 8L8 2M8 2H5M8 2V5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RIGHT_LABEL = (
  <>CRAF&apos;<span style={{ textTransform: "none" }}>d</span>-supported data &amp; insights for this region</>
);

// ── Types ─────────────────────────────────────────────────
interface HexGeom { outer: string; inner: string; cx: number; cy: number }
interface Ripple { region: string; ox: number; oy: number; key: number }

// Wave speed: ms of stagger delay added per SVG unit of distance from the
// clicked hexagon. Lower = faster ripple.
const RIPPLE_SPEED = 0.45;

// ── Memoized region tile group ────────────────────────────
// Renders the static hex polygons for one region. Memoized so that hovering /
// locking a different region does not re-render the ~1500 polygons of regions
// whose props are unchanged.
const RegionTiles = memo(function RegionTiles({
  region,
  polygons,
  highlighted,
  dimmed,
  isMobile,
  ripple,
  onEnter,
  onLeave,
  onActivate,
}: {
  region: string;
  polygons: HexGeom[];
  highlighted: boolean;
  dimmed: boolean;
  isMobile: boolean;
  ripple: Ripple | null;
  onEnter: (region: string) => void;
  onLeave: () => void;
  onActivate: (e: React.MouseEvent, region: string) => void;
}) {
  return (
    <g
      role="button"
      aria-label={region}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onActivate(e as unknown as React.MouseEvent, region); }}
      onMouseEnter={() => { if (!isMobile) onEnter(region); }}
      onMouseLeave={() => { if (!isMobile) onLeave(); }}
      onClick={(e) => onActivate(e, region)}
      style={{
        cursor: "pointer",
        outline: "none",
        filter: highlighted
          ? "drop-shadow(0 0 3px rgba(249,225,173,0.76)) drop-shadow(0 0 9px rgba(249,225,173,0.52)) drop-shadow(0 2px 5px rgba(0,0,0,0.10))"
          : "none",
        opacity: dimmed ? 0.70 : 1,
        transition: "filter 160ms ease, opacity 160ms ease",
      }}
    >
      {polygons.map((p, i) => {
        const delay = ripple ? Math.hypot(p.cx - ripple.ox, p.cy - ripple.oy) * RIPPLE_SPEED : 0;
        return (
          <Fragment key={i}>
            {/* Transparent full-radius polygon fills inter-hex gaps */}
            <polygon points={p.outer} fill="transparent" stroke="none" />
            <polygon
              // Changing key when a new ripple fires remounts the polygon so
              // the CSS pop animation replays from the start.
              key={ripple ? `r${ripple.key}` : "s"}
              points={p.inner}
              fill="white"
              stroke="none"
              className={ripple ? styles.rippleHex : undefined}
              style={ripple ? { animationDelay: `${delay}ms` } : { transition: "fill 140ms ease" }}
            />
          </Fragment>
        );
      })}
    </g>
  );
});

// ── Shared pill component ─────────────────────────────────
function ProjectPill({ label, url, isRegional, tooltip }: { label: string; url: string | null; isRegional: boolean; tooltip?: string | null }) {
  const pill = (
    <li
      className={styles.projectBlock}
      style={isRegional ? { background: "#F3C35C", borderColor: "rgba(180,120,0,0.35)" } : undefined}
    >
      {url
        ? <a href={url} target="_blank" rel="noreferrer">{label}{ARROW_ICON}</a>
        : <span tabIndex={0}>{label}</span>}
    </li>
  );
  if (!tooltip || tooltip === label) return pill;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{pill}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-center">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// ── Pure helpers ──────────────────────────────────────────
function splitLabel(name: string): [string, string] {
  const words = name.split(" ");
  if (words.length <= 2) return [words[0], words.slice(1).join(" ")];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
  }).join(" ");
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ── Component ─────────────────────────────────────────────
export default function ImpactMap({ projects, orgs }: Props) {
  const [tileData, setTileData] = useState<TileData | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const [ripple, setRipple] = useState<Ripple | null>(null);
  const [displayCount, setDisplayCount] = useState(1);
  const rippleSeq = useRef(0);
  const isMobile = useMediaQuery("(max-width: 640px)");
  // Default true to avoid a flash of the title when embedded
  const [isEmbedded, setIsEmbedded] = useState(true);
  useEffect(() => { setIsEmbedded(window.self !== window.top); }, []);
  const [animVB, setAnimVB] = useState({ x: 0, y: -100, w: 1600, h: 1000 });
  const [expandedCats, setExpandedCats] = useState<Set<string>>(() => new Set(VALID_CATEGORIES));

  // Mirror animVB into a ref so animation frames / touch handlers can read the
  // latest viewBox without re-subscribing. Synced in an effect (not during
  // render) to satisfy react-hooks/refs.
  const animVBRef = useRef(animVB);
  useEffect(() => {
    animVBRef.current = animVB;
  }, [animVB]);
  const rafRef = useRef<number | null>(null);
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasDraggedRef = useRef(false);

  const activeRegion = locked ?? hovered ?? "Global";

  // ── Data loading ────────────────────────────────────────
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/data/hex-tiles.json", { signal: ctrl.signal })
      .then((r) => r.json())
      .then(setTileData)
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  // ── Derived data ────────────────────────────────────────
  const filteredProjects = useMemo(
    () => projects.filter((p) => p.project_short_title && !EXCLUDED_PROJECTS.has(p.project_short_title)),
    [projects],
  );

  const projectsByRegion = useMemo(() => {
    const map = new Map<string, CrafdProject[]>();
    for (const p of filteredProjects) {
      for (const r of coverageToRegions(p.project_coverage)) {
        if (!map.has(r)) map.set(r, []);
        map.get(r)!.push(p);
      }
    }
    return map;
  }, [filteredProjects]);

  const regionCentroids = useMemo(() => {
    if (!tileData) return new Map<string, [number, number]>();
    const out = new Map<string, [number, number]>();
    for (const [region, tiles] of Object.entries(tileData.tilesByRegion)) {
      const cx = tiles.reduce((s, t) => s + t.x, 0) / tiles.length;
      const cy = tiles.reduce((s, t) => s + t.y, 0) / tiles.length;
      out.set(region, [cx, cy]);
    }
    return out;
  }, [tileData]);

  // BFS depth from ocean: depth 1 = edge tile, higher = more interior.
  // Used to scale hex radius for a bevelled-edge look.
  // Flat-top neighbor rules differ for even vs odd columns.
  const tileDepth = useMemo(() => {
    if (!tileData) return new Map<string, number>();
    const ckey = (col: number, row: number) => `${col},${row}`;
    const allTiles = new Map<string, HexTile>();
    for (const tiles of Object.values(tileData.tilesByRegion)) {
      for (const t of tiles) allTiles.set(ckey(t.col, t.row), t);
    }
    function neighbors(col: number, row: number): [number, number][] {
      const even = col % 2 === 0;
      return [
        [col, row - 1], [col, row + 1],
        [col - 1, even ? row - 1 : row], [col - 1, even ? row : row + 1],
        [col + 1, even ? row - 1 : row], [col + 1, even ? row : row + 1],
      ];
    }
    const depth = new Map<string, number>();
    const queue: Array<[number, number]> = [];
    for (const t of allTiles.values()) {
      const missing = neighbors(t.col, t.row).some(([nc, nr]) => !allTiles.has(ckey(nc, nr)));
      if (missing) { depth.set(ckey(t.col, t.row), 1); queue.push([t.col, t.row]); }
    }
    let head = 0;
    while (head < queue.length) {
      const [col, row] = queue[head++];
      const d = depth.get(ckey(col, row))!;
      for (const [nc, nr] of neighbors(col, row)) {
        const k = ckey(nc, nr);
        if (allTiles.has(k) && !depth.has(k)) { depth.set(k, d + 1); queue.push([nc, nr]); }
      }
    }
    return depth;
  }, [tileData]);

  // Precompute the (static) hex polygon point strings per region once. Tile
  // geometry never changes, so this avoids re-running ~3000 trig calculations
  // on every hover/lock interaction — only highlight styling changes then.
  const regionGeometry = useMemo(() => {
    if (!tileData) return new Map<string, HexGeom[]>();
    const drawR = tileData.hexRadius;
    const out = new Map<string, HexGeom[]>();
    for (const [region, regionTiles] of Object.entries(tileData.tilesByRegion)) {
      const geom = regionTiles.map((t) => {
        const depth = tileDepth.get(`${t.col},${t.row}`) ?? 3;
        const r = depth === 1 ? drawR * 0.65
                : depth === 2 ? drawR * 0.70
                : depth === 3 ? drawR * 0.75
                : depth === 4 ? drawR * 0.80
                : drawR * 0.85;
        return { outer: hexPoints(t.x, t.y, drawR), inner: hexPoints(t.x, t.y, r), cx: t.x, cy: t.y };
      });
      out.set(region, geom);
    }
    return out;
  }, [tileData, tileDepth]);

  // ── Mobile viewBox animation ─────────────────────────────
  const targetVB = useMemo(() => {
    if (!isMobile || !locked || !tileData) return null;
    const tiles = tileData.tilesByRegion[locked];
    if (!tiles || tiles.length === 0) return null;
    const xs = tiles.map((t) => t.x);
    const ys = tiles.map((t) => t.y);
    const pad = 80;
    const w = Math.max(Math.max(...xs) - Math.min(...xs) + pad * 2, 260);
    const h = Math.max(Math.max(...ys) - Math.min(...ys) + pad * 2, 180);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }, [isMobile, locked, tileData]);

  useEffect(() => {
    if (!tileData) return;
    const target = targetVB ?? { x: 0, y: -100, w: tileData.width, h: tileData.height + 100 };
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const start = { ...animVBRef.current };
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / 600, 1);
      const e = easeInOut(p);
      setAnimVB({
        x: start.x + (target.x - start.x) * e,
        y: start.y + (target.y - start.y) * e,
        w: start.w + (target.w - start.w) * e,
        h: start.h + (target.h - start.h) * e,
      });
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else rafRef.current = null;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [targetVB, tileData]);

  // ── Touch pan ────────────────────────────────────────────
  useEffect(() => {
    if (!isMobile) return;
    const maybeEl = mapWrapperRef.current;
    if (!maybeEl) return;
    const el: HTMLDivElement = maybeEl;
    const THRESHOLD = 5;

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) { touchStartRef.current = null; return; }
      if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      hasDraggedRef.current = false;
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    function onTouchMove(e: TouchEvent) {
      if (!touchStartRef.current || e.touches.length !== 1) return;
      e.preventDefault();
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      const dy = e.touches[0].clientY - touchStartRef.current.y;
      if (!hasDraggedRef.current) {
        if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
        hasDraggedRef.current = true;
      }
      const scale = animVBRef.current.w / el.getBoundingClientRect().width;
      setAnimVB((prev) => ({ ...prev, x: prev.x - dx * scale, y: prev.y - dy * scale }));
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    function onTouchEnd() { touchStartRef.current = null; }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [isMobile]);

  // ── Interaction ──────────────────────────────────────────
  const isHighlighted = useCallback((region: string) =>
    locked ? region === locked : region === hovered,
  [locked, hovered]);

  const handleTileClick = useCallback((e: React.MouseEvent, region: string) => {
    e.stopPropagation();
    if (hasDraggedRef.current) return;

    // Convert the click point into SVG user-space so the ripple can radiate
    // from the exact hexagon that was clicked. Keyboard activation (clientX/Y
    // both 0) is skipped via the NaN guard below — no ripple, just selection.
    const svg = (e.target as SVGElement).ownerSVGElement;
    let ox = NaN, oy = NaN;
    const isPointer = e.clientX !== 0 || e.clientY !== 0;
    if (svg && isPointer) {
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
        ox = pt.x; oy = pt.y;
      }
    }

    const willSelect = isMobile ? true : locked !== region;
    if (willSelect && !Number.isNaN(ox) && !Number.isNaN(oy)) {
      setRipple({ region, ox, oy, key: ++rippleSeq.current });
    }
    if (isMobile) setLocked(region);
    else setLocked((prev) => (prev === region ? null : region));
  }, [isMobile, locked]);

  const handleEnter = useCallback((region: string) => setHovered(region), []);
  const handleLeave = useCallback(() => setHovered(null), []);

  // Clear the ripple once the wave has finished so polygons return to their
  // resting (non-animated) state. Max distance across a region * speed + the
  // single-hex animation duration covers the slowest tile.
  useEffect(() => {
    if (!ripple) return;
    const t = setTimeout(() => setRipple(null), 1400);
    return () => clearTimeout(t);
  }, [ripple]);

  const toggleCat = useCallback((cat: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }, []);

  // ── Project grouping ─────────────────────────────────────
  const isSelected = locked !== null || hovered !== null;
  const globalProjects = useMemo(() => projectsByRegion.get("Global") ?? [], [projectsByRegion]);

  // ── Count animation ─────────────────────────────────────
  // Only animate when a region is locked (clicked), not on hover
  const lockedCount = useMemo(
    () => locked !== null
      ? (globalProjects.length + (projectsByRegion.get(locked)?.length ?? 0))
      : globalProjects.length,
    [locked, globalProjects, projectsByRegion],
  );

  const hoveredCount = useMemo(
    () => hovered !== null
      ? (globalProjects.length + (projectsByRegion.get(hovered)?.length ?? 0))
      : globalProjects.length,
    [hovered, globalProjects, projectsByRegion],
  );

  // Reset counter to 1 when locked region changes
  useEffect(() => {
    setDisplayCount(1);
  }, [lockedCount]);

  // Count up to target
  useEffect(() => {
    if (displayCount === lockedCount) return;

    const interval = setInterval(() => {
      setDisplayCount((prev) => {
        if (prev < lockedCount) return prev + 1;
        return lockedCount;
      });
    }, 30);

    return () => clearInterval(interval);
  }, [lockedCount, displayCount]);

  const regionalProjects = useMemo(
    () => isSelected ? (projectsByRegion.get(activeRegion) ?? []) : [],
    [isSelected, projectsByRegion, activeRegion],
  );
  const hasRegional = isSelected && regionalProjects.length > 0;

  const groupedCategories = useMemo(() => {
    const regionalLabels = new Set<string>();
    let source: CrafdProject[];

    if (hasRegional) {
      for (const p of regionalProjects) {
        if (!p.project_short_title) continue;
        const leadId = p.linked_lead_org?.[0];
        regionalLabels.add((leadId && orgs[leadId]) || p.project_short_title);
      }
      source = [...globalProjects, ...regionalProjects];
    } else {
      source = globalProjects;
    }

    const grouped = new Map<string, Map<string, { url: string | null; isRegional: boolean; tooltip: string | null }>>();
    for (const p of source) {
      if (!p.project_short_title) continue;
      const cat = PROJECT_CATEGORIES[p.project_short_title];
      if (!cat) continue;
      const leadId = p.linked_lead_org?.[0];
      const orgName = (leadId && orgs[leadId]) || p.project_short_title;
      const label = ORG_NAME_MAP[orgName] || orgName;
      if (!grouped.has(cat)) grouped.set(cat, new Map());
      const catMap = grouped.get(cat)!;
      if (!catMap.has(label)) {
        catMap.set(label, { url: p.project_url ?? null, isRegional: regionalLabels.has(label), tooltip: p.full_title ?? null });
      } else if (regionalLabels.has(label)) {
        catMap.get(label)!.isRegional = true;
      }
    }
    return VALID_CATEGORIES
      .filter((c) => grouped.has(c))
      .map((c) => ({
        category: c,
        entries: Array.from(grouped.get(c)!.entries()).map(([label, meta]) => ({ label, ...meta })),
      }))
      .sort((a, b) => {
        // "Ecosystem Backbone" always goes last (rightmost)
        if (a.category === "Ecosystem Backbone") return 1;
        if (b.category === "Ecosystem Backbone") return -1;
        // Otherwise sort by entries length descending
        return b.entries.length - a.entries.length;
      });
  }, [hasRegional, regionalProjects, globalProjects, orgs]);

  // ── Early exit ───────────────────────────────────────────
  if (!tileData) return <div className={styles.root} />;

  // ── SVG ──────────────────────────────────────────────────
  const svgViewBox = isMobile
    ? `${animVB.x} ${animVB.y} ${animVB.w} ${animVB.h}`
    : `0 -60 ${tileData.width} ${tileData.height + 100}`;

  const mapSvg = (
    <svg
      className={styles.svg}
      viewBox={svgViewBox}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
      style={{ overflow: "visible" }}
      role="img"
      aria-label="World map divided into UN regions. Select a region to see CRAF'd projects active there."
    >
      <rect x={-100} y={-300} width={tileData.width + 200} height={tileData.height + 600} fill="#fdb53c" />

      {Array.from(regionGeometry.entries()).map(([region, polygons]) => {
        const hl = isHighlighted(region);
        return (
          <RegionTiles
            key={region}
            region={region}
            polygons={polygons}
            highlighted={hl}
            dimmed={(hovered !== null || locked !== null) && !hl}
            isMobile={isMobile}
            ripple={ripple && ripple.region === region ? ripple : null}
            onEnter={handleEnter}
            onLeave={handleLeave}
            onActivate={handleTileClick}
          />
        );
      })}

      {Array.from(regionCentroids.entries()).map(([region, [cx, cy]]) => {
        const [line1, line2] = splitLabel(region);
        const hl = isHighlighted(region);
        const bgW = Math.max(line1.length, line2?.length ?? 0) * 9 + 28;
        const bgH = line2 ? 44 : 30;
        return (
          <g key={region} style={{ pointerEvents: "none", userSelect: "none", opacity: hl ? 1 : 0, transition: "opacity 180ms ease" }}>
            <rect x={cx - bgW / 2} y={cy - (line2 ? 22 : 25)} width={bgW} height={bgH} rx={8} fill="#fef9ef" stroke="rgba(51,51,51,0.3)" strokeWidth={1} />
            <text textAnchor="middle" fontFamily="Roboto, sans-serif" fontWeight={600} fontSize={12} letterSpacing={1.2} fill={hl ? "rgba(70,70,70,0.95)" : "rgba(90,90,90,0.75)"}>
              <tspan x={cx} y={cy - 5}>{line1.toUpperCase()}</tspan>
              {line2 && <tspan x={cx} dy={15}>{line2.toUpperCase()}</tspan>}
            </text>
          </g>
        );
      })}
    </svg>
  );

  // ── Category renderers ───────────────────────────────────
  const renderCategoryBoxes = (cats: typeof groupedCategories) =>
    cats.map(({ category, entries }) => (
      <div key={category} className={styles.categoryBox}>
        <p className={styles.categoryGroupHeader}>{category.toUpperCase()}</p>
        <ul className={styles.projectList} style={entries.length > 4 ? { gridTemplateColumns: "repeat(3, auto)" } : undefined}>
          {entries.map((entry) => <ProjectPill key={entry.label} {...entry} />)}
        </ul>
      </div>
    ));

  const renderMobileCategoryBoxes = (cats: typeof groupedCategories) =>
    cats.map(({ category, entries }) => {
      const isOpen = expandedCats.has(category);
      return (
        <div key={category} className={styles.mobileCategoryBox}>
          <button className={styles.mobileCategoryHeader} onClick={() => toggleCat(category)} aria-expanded={isOpen}>
            <span>{category.toUpperCase()}</span>
            <span style={{ display: "inline-block", transition: "transform 180ms ease", transform: isOpen ? "rotate(180deg)" : "none", fontSize: 14, color: "#999" }}>∨</span>
          </button>
          {isOpen && (
            <ul className={styles.mobileProjectList}>
              {entries.map((entry) => <ProjectPill key={entry.label} {...entry} />)}
            </ul>
          )}
        </div>
      );
    });

  // ── Legend ───────────────────────────────────────────────
  const legend = hasRegional && (
    <div className={styles.legend}>
      <div className={styles.legendItem}>
        <span className={`${styles.legendSwatch} ${styles.legendSwatchGlobal}`} />
        Global Coverage
      </div>
      <div className={styles.legendItem}>
        <span className={`${styles.legendSwatch} ${styles.legendSwatchRegional}`} />
        Regional Coverage
      </div>
    </div>
  );

  // ── Mobile layout ────────────────────────────────────────
  if (isMobile) {
    const noRegionalData = isSelected && groupedCategories.length === 0;
    return (
      <div className={styles.mobileRoot}>
        <div className={styles.mobileTopCard}>
          {isSelected ? (
            <>
              <button className={styles.mobileBack} onClick={() => setLocked(null)}>← Global</button>
              <h1 className={styles.zoneTitle}>{activeRegion}</h1>
              {legend}
            </>
          ) : (
            <>
              <h1 className={styles.zoneTitle}>Global</h1>
              <p className={styles.zoneHint}>Tap regions to explore</p>
            </>
          )}
        </div>

        <div ref={mapWrapperRef} className={styles.mobileMapWrapper}>
          {mapSvg}
        </div>

        <div className={styles.mobileBottomCard}>
          <p className={styles.zoneRightLabel}>
            {noRegionalData ? "No region-specific data — showing global projects" : RIGHT_LABEL}
          </p>
          {renderMobileCategoryBoxes(groupedCategories)}
        </div>
      </div>
    );
  }

  // ── Desktop layout ───────────────────────────────────────
  return (
    <div className={styles.root} onClick={() => setLocked(null)}>
      {mapSvg}
      {!isEmbedded && (
        <div className={styles.overlayTitle}>
          <span className={styles.overlayTitleCount}>
            {locked !== null ? displayCount : hoveredCount}
          </span>
          CRAF&apos;d-supported Projects<br />
          provide Data for Crisis action{" "}
          {locked !== null ? <>in {locked}</> : hovered !== null ? <>in {hovered}</> : <>globally</>}
        </div>
      )}
      <div className={styles.card} role="region" aria-label="Project details" onClick={(e) => e.stopPropagation()}>
        <div className={styles.zoneLeft} style={{ position: "relative" }}>
          {locked && (
            <button className={styles.closeBtn} onClick={() => setLocked(null)} aria-label="Deselect region">×</button>
          )}
          {isSelected ? (
            <>
              <h1 className={styles.zoneTitle}>{activeRegion}</h1>
              {legend}
            </>
          ) : (
            <>
              <h1 className={styles.zoneTitle}>Global</h1>
              <p className={styles.zoneHint}>Hover on regions to see<br />region specific projects</p>
            </>
          )}
        </div>
        <div className={styles.zoneDivider} />
        <div className={styles.zoneRight}>
          <p className={styles.zoneRightLabel}>{RIGHT_LABEL}</p>
          <div className={styles.categoryColumns}>
            {renderCategoryBoxes(groupedCategories)}
          </div>
        </div>
      </div>
    </div>
  );
}
