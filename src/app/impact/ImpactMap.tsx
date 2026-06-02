"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CrafdProject } from "@/types";
import { coverageToRegions } from "./coverage-map";
import styles from "./impact-map.module.css";

interface HexTile { x: number; y: number; col: number; row: number }
interface TileData { width: number; height: number; hexRadius: number; tilesByRegion: Record<string, HexTile[]> }
interface Props { projects: CrafdProject[]; orgs: Record<string, string>; variant?: "flat" | "density" | "dark" }

const PROJECT_CATEGORIES: Record<string, string> = {
  "Hazard Modeling":                        "Crisis Anticipation & Warning",
  "GEOGUARD":                               "Crisis Anticipation & Warning",
  "INFORM Warning":                         "Crisis Anticipation & Warning",
  "eEARTH":                                 "Crisis Anticipation & Warning",
  "CLIFDEW-GRID":                           "Crisis Anticipation & Warning",
  "Maintaining ACLED":                      "Conflict & Peace",
  "ACLED Data":                             "Conflict & Peace",
  "Women's Mobilization Within Armed Groups": "Conflict & Peace",
  "VIEWS-PIN":                              "Conflict & Peace",
  "EMPOW":                                  "Conflict & Peace",
  "Kente Threads":                          "Displacement",
  "Internal Displacement Data":             "Displacement",
  "Conflict Climate Displacement":          "Crisis Anticipation & Warning",
  "PRIMARI":                                "Displacement",
  "Transformative Outcomes":                "Needs & Impact",
  "GUARD":                                  "Needs & Impact",
  "Rapid Assessment Data":                  "Needs & Impact",
  "Risk DataHub":                           "Ecosystem Backbone",
  "Strengthening CRAF'd Ecosystem":         "Ecosystem Backbone",
};

const VALID_CATEGORIES = [
  "Crisis Anticipation & Warning",
  "Conflict & Peace",
  "Displacement",
  "Needs & Impact",
  "Ecosystem Backbone",
];

const DENSITY_LOW: [number, number, number] = [246, 210, 133];
const DENSITY_HIGH: [number, number, number] = [253, 247, 234];

function lerpHex(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

const EXCLUDED_PROJECTS = new Set([
  "CRAF'd Direct Costs",
  "CRAF'd Sec.Direct Cost 2022",
  "MPTFO Admin (1%)",
]);

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

export default function ImpactMap({ projects, orgs, variant = "flat" }: Props) {
  const [tileData, setTileData] = useState<TileData | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [animVB, setAnimVB] = useState({ x: 0, y: -100, w: 1600, h: 1000 });
  const animVBRef = useRef(animVB);
  animVBRef.current = animVB;
  const rafRef = useRef<number | null>(null);

  const activeRegion = locked ?? hovered ?? "Global";

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/data/hex-tiles.json", { signal: ctrl.signal })
      .then((r) => r.json())
      .then(setTileData)
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

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

  const regionDensity = useMemo(() => {
    if (variant !== "density") return null;
    const globalCount = projectsByRegion.get("Global")?.length ?? 0;
    const map = new Map<string, number>();
    for (const [r, ps] of projectsByRegion) {
      if (r === "Global") continue;
      map.set(r, globalCount + ps.length);
    }
    const maxDensity = map.size > 0 ? Math.max(...map.values()) : globalCount;
    return { map, globalCount, maxDensity };
  }, [projectsByRegion, variant]);

  const densityFill = useCallback((region: string): string => {
    if (!regionDensity) return "rgba(255,255,255,0.28)";
    const { map, globalCount, maxDensity } = regionDensity;
    const count = map.get(region) ?? globalCount;
    const t = maxDensity === globalCount ? 0 : (count - globalCount) / (maxDensity - globalCount);
    return lerpHex(DENSITY_LOW, DENSITY_HIGH, t);
  }, [regionDensity]);

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

  // BFS depth from ocean: uses exact integer (col, row) arithmetic — no float rounding.
  // depth 1 = touches ocean, depth 2 = one ring inward, depth 3+ = true interior.
  // Flat-top neighbor rules (even/odd col differ in which row the diagonal lands on).
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
    // Seed: tiles with at least one missing neighbor are depth-1
    for (const t of allTiles.values()) {
      const missing = neighbors(t.col, t.row).some(([nc, nr]) => !allTiles.has(ckey(nc, nr)));
      if (missing) { depth.set(ckey(t.col, t.row), 1); queue.push([t.col, t.row]); }
    }
    // BFS inward
    let head = 0;
    while (head < queue.length) {
      const [col, row] = queue[head++];
      const d = depth.get(ckey(col, row))!;
      for (const [nc, nr] of neighbors(col, row)) {
        const k = ckey(nc, nr);
        if (allTiles.has(k) && !depth.has(k)) {
          depth.set(k, d + 1);
          queue.push([nc, nr]);
        }
      }
    }
    return depth;
  }, [tileData]);

  // Target viewBox for mobile: bounding box of the locked region's tiles + padding
  const targetVB = useMemo(() => {
    if (!isMobile || !locked || !tileData) return null;
    const tiles = tileData.tilesByRegion[locked];
    if (!tiles || tiles.length === 0) return null;
    const xs = tiles.map((t) => t.x);
    const ys = tiles.map((t) => t.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = 80;
    const w = Math.max(maxX - minX + pad * 2, 260);
    const h = Math.max(maxY - minY + pad * 2, 180);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }, [isMobile, locked, tileData]);

  // Animate viewBox: runs whenever targetVB or tileData changes
  useEffect(() => {
    if (!tileData) return;
    const defaultVB = { x: 0, y: -100, w: tileData.width, h: tileData.height + 100 };
    const target = targetVB ?? defaultVB;

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const start = { ...animVBRef.current };
    const t0 = performance.now();
    const dur = 600;

    const tick = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
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

  const isHighlighted = useCallback((region: string): boolean => {
    if (locked) return region === locked;
    return region === hovered;
  }, [locked, hovered]);

  const handleTileClick = useCallback((e: React.MouseEvent, region: string) => {
    e.stopPropagation();
    if (isMobile) {
      setLocked(region);
    } else {
      setLocked((prev) => (prev === region ? null : region));
    }
  }, [isMobile]);

  const isSelected = locked !== null || hovered !== null;
  const globalProjects = useMemo(
    () => projectsByRegion.get("Global") ?? [],
    [projectsByRegion],
  );
  const regionalProjects = useMemo(
    () => isSelected ? (projectsByRegion.get(activeRegion) ?? []) : [],
    [isSelected, projectsByRegion, activeRegion],
  );
  const hasRegional = isSelected && regionalProjects.length > 0;
  const drawR = tileData ? tileData.hexRadius : 9;

  const groupedCategories = useMemo(() => {
    let source: CrafdProject[];
    let regionalLabels = new Set<string>();

    if (variant === "dark") {
      const hasRegional = isSelected && regionalProjects.length > 0;
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
    } else {
      source = isSelected ? regionalProjects : globalProjects;
    }

    const grouped = new Map<string, Map<string, { url: string | null; isRegional: boolean }>>();
    for (const p of source) {
      if (!p.project_short_title) continue;
      const cat = PROJECT_CATEGORIES[p.project_short_title];
      if (!cat) continue;
      const leadId = p.linked_lead_org?.[0];
      const label = (leadId && orgs[leadId]) || p.project_short_title;
      if (!grouped.has(cat)) grouped.set(cat, new Map());
      const catMap = grouped.get(cat)!;
      if (!catMap.has(label)) {
        catMap.set(label, { url: p.project_url ?? null, isRegional: regionalLabels.has(label) });
      } else if (regionalLabels.has(label)) {
        catMap.get(label)!.isRegional = true;
      }
    }
    return VALID_CATEGORIES
      .filter((c) => grouped.has(c))
      .map((c) => ({
        category: c,
        entries: Array.from(grouped.get(c)!.entries()).map(([label, { url, isRegional }]) => ({ label, url, isRegional })),
      }))
      .sort((a, b) => b.entries.length - a.entries.length);
  }, [isSelected, regionalProjects, globalProjects, orgs, variant]);

  const globalGroupedCategories = useMemo(() => {
    const grouped = new Map<string, Map<string, { url: string | null; isRegional: boolean }>>();
    for (const p of globalProjects) {
      if (!p.project_short_title) continue;
      const cat = PROJECT_CATEGORIES[p.project_short_title];
      if (!cat) continue;
      const leadId = p.linked_lead_org?.[0];
      const label = (leadId && orgs[leadId]) || p.project_short_title;
      if (!grouped.has(cat)) grouped.set(cat, new Map());
      const catMap = grouped.get(cat)!;
      if (!catMap.has(label)) catMap.set(label, { url: p.project_url ?? null, isRegional: false });
    }
    return VALID_CATEGORIES
      .filter((c) => grouped.has(c))
      .map((c) => ({
        category: c,
        entries: Array.from(grouped.get(c)!.entries()).map(([label, { url, isRegional }]) => ({ label, url, isRegional })),
      }))
      .sort((a, b) => b.entries.length - a.entries.length);
  }, [globalProjects, orgs]);

  if (!tileData) return <div className={styles.root} />;

  const svgViewBox = isMobile
    ? `${animVB.x} ${animVB.y} ${animVB.w} ${animVB.h}`
    : `0 -100 ${tileData.width} ${tileData.height + 100}`;

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

      {Object.entries(tileData.tilesByRegion).map(([region, regionTiles]) => {
        const hl = isHighlighted(region);
        return (
          <g
            key={region}
            role="button"
            aria-label={region}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleTileClick(e as unknown as React.MouseEvent, region); }}
            onMouseEnter={() => { if (!isMobile) setHovered(region); }}
            onMouseLeave={() => { if (!isMobile) setHovered(null); }}
            onClick={(e) => handleTileClick(e, region)}
            style={{
              cursor: "pointer",
              outline: "none",
              filter: hl
                ? "drop-shadow(0 0 3px rgba(249,225,173,0.76)) drop-shadow(0 0 9px rgba(249,225,173,0.52)) drop-shadow(0 2px 5px rgba(0,0,0,0.10))"
                : "none",
              opacity: (hovered !== null || locked !== null) && !hl ? 0.70 : 1,
              transition: "filter 160ms ease, opacity 160ms ease",
            }}
          >
            {regionTiles.map((t, i) => {
              const depth = tileDepth.get(`${t.col},${t.row}`) ?? 3;
              const r = depth === 1 ? drawR * 0.65
                      : depth === 2 ? drawR * 0.70
                      : depth === 3 ? drawR * 0.75
                      : depth === 4 ? drawR * 0.80
                      : drawR * 0.85;
              return (
                <Fragment key={i}>
                  {/* Full-radius transparent polygon fills gaps between scaled visuals */}
                  <polygon points={hexPoints(t.x, t.y, drawR)} fill="transparent" stroke="none" />
                  <polygon
                    points={hexPoints(t.x, t.y, r)}
                    fill={variant === "density" ? (hl ? "rgba(255,255,255,0.80)" : densityFill(region)) : "white"}
                    stroke="none"
                    style={{ transition: "fill 140ms ease" }}
                  />
                </Fragment>
              );
            })}
          </g>
        );
      })}

      {Array.from(regionCentroids.entries()).map(([region, [cx, cy]]) => {
        const [line1, line2] = splitLabel(region);
        const hl = isHighlighted(region);
        const maxLen = Math.max(line1.length, line2.length);
        const bgW = maxLen * 9 + 28;
        const bgH = line2 ? 44 : 30;
        return (
          <g key={region} style={{ pointerEvents: "none", userSelect: "none" }}>
            <rect
              x={cx - bgW / 2}
              y={cy - (line2 ? 22 : 25)}
              width={bgW}
              height={bgH}
              rx={8}
              fill="#fef9ef"
              stroke="rgba(51,51,51,0.3)"
              strokeWidth={1}
            />
            <text
              textAnchor="middle"
              fontFamily="Roboto, sans-serif"
              fontWeight={600}
              fontSize={12}
              letterSpacing={1.2}
              fill={variant === "density" ? "#BC840F" : (hl ? "rgba(70,70,70,0.95)" : "rgba(90,90,90,0.75)")}
              stroke={variant === "density" ? "rgba(68,42,10,0.65)" : undefined}
              strokeWidth={variant === "density" ? 0.5 : undefined}
              style={variant === "density" ? { paintOrder: "stroke fill" } : undefined}
            >
              <tspan x={cx} y={cy - 5}>{line1.toUpperCase()}</tspan>
              {line2 && <tspan x={cx} dy={15}>{line2.toUpperCase()}</tspan>}
            </text>
          </g>
        );
      })}
    </svg>
  );

  const rightLabel = <>CRAF&apos;<span style={{ textTransform: "none" }}>d</span>-supported data &amp; insights for this region...</>;

  const arrowIcon = (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true" style={{ flexShrink: 0, opacity: 0.5 }}>
      <path d="M2 8L8 2M8 2H5M8 2V5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const renderCategoryBoxes = (cats: typeof groupedCategories, highlight: boolean) =>
    cats.map(({ category, entries }) => (
      <div key={category} className={styles.categoryBox}>
        <p className={styles.categoryGroupHeader}>{category.toUpperCase()}</p>
        <ul
            className={styles.projectList}
            style={entries.length > 4 ? { gridTemplateColumns: "repeat(3, auto)" } : undefined}
          >
          {entries.map(({ label, url, isRegional }) => (
            <li
              key={label}
              className={styles.projectBlock}
              style={(variant === "dark" ? isRegional : highlight)
                ? { background: "#F3C35C", borderColor: "rgba(180,120,0,0.35)" }
                : undefined}
            >
              {url ? (
                <a href={url} target="_blank" rel="noreferrer">{label}{arrowIcon}</a>
              ) : (
                <span tabIndex={0}>{label}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    ));

  const categoryColumns = renderCategoryBoxes(groupedCategories, isSelected);
  const globalCategoryColumns = renderCategoryBoxes(globalGroupedCategories, false);

  // ── Mobile layout ─────────────────────────────────────────
  if (isMobile) {
    const noRegionalData = isSelected && groupedCategories.length === 0;
    return (
      <div className={styles.mobileRoot}>
        <div className={styles.mobileTopCard}>
          {isSelected ? (
            <>
              <button className={styles.mobileBack} onClick={() => setLocked(null)}>
                ← Global
              </button>
              <h1 className={styles.zoneTitle}>{activeRegion}</h1>
              {hasRegional && (
                <div className={styles.legend}>
                  {variant === "dark" && (
                    <div className={styles.legendItem}>
                      <span className={`${styles.legendSwatch} ${styles.legendSwatchGlobal}`} />
                      Global Coverage
                    </div>
                  )}
                  <div className={styles.legendItem}>
                    <span className={`${styles.legendSwatch} ${styles.legendSwatchRegional}`} />
                    Regional Coverage
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <h1 className={styles.zoneTitle}>Global</h1>
              <p className={styles.zoneHint}>Tap regions to explore</p>
            </>
          )}
        </div>

        <div className={styles.mobileMapWrapper}>
          {mapSvg}
        </div>

        <div className={styles.mobileBottomCard}>
          {noRegionalData ? (
            <>
              <p className={styles.zoneRightLabel}>No region-specific data — showing global projects</p>
              <div className={styles.categoryColumns}>{globalCategoryColumns}</div>
            </>
          ) : (
            <>
              <p className={styles.zoneRightLabel}>{rightLabel}</p>
              <div className={styles.categoryColumns}>{categoryColumns}</div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Desktop layout ────────────────────────────────────────
  return (
    <div className={styles.root} onClick={() => setLocked(null)}>
      {mapSvg}

      <div className={styles.card} role="region" aria-label="Project details" onClick={(e) => e.stopPropagation()}>
        <div className={styles.zoneLeft} style={{ position: "relative" }}>
          {locked && (
            <button
              className={styles.closeBtn}
              onClick={() => setLocked(null)}
              aria-label="Deselect region"
            >
              ×
            </button>
          )}
          {isSelected ? (
            <>
              <h1 className={styles.zoneTitle}>{activeRegion}</h1>
              {hasRegional && (
                <div className={styles.legend}>
                  {variant === "dark" && (
                    <div className={styles.legendItem}>
                      <span className={`${styles.legendSwatch} ${styles.legendSwatchGlobal}`} />
                      Global Coverage
                    </div>
                  )}
                  <div className={styles.legendItem}>
                    <span className={`${styles.legendSwatch} ${styles.legendSwatchRegional}`} />
                    Regional Coverage
                  </div>
                </div>
              )}
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
          <p className={styles.zoneRightLabel}>{rightLabel}</p>
          <div className={styles.categoryColumns}>
            {categoryColumns}
          </div>
        </div>
      </div>
    </div>
  );
}
