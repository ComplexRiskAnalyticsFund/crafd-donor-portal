"use client";

import { useEffect, useMemo, useState } from "react";
import type { CrafdProject } from "@/types";
import { coverageToRegions } from "./coverage-map";
import styles from "./impact-map.module.css";

interface HexTile { x: number; y: number; region: string }
interface TileData { width: number; height: number; hexRadius: number; tiles: HexTile[] }
interface Props { projects: CrafdProject[]; variant?: "flat" | "density" }

const DENSITY_LOW: [number, number, number] = [246, 210, 133]; // #F6D285 — floor (fewest)
const DENSITY_HIGH: [number, number, number] = [253, 247, 234]; // #FDF7EA — ceiling (most)

function lerpHex(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

const EXCLUDED_PROJECTS = new Set([
  "CRAF'd Direct Costs",
  "CRAF'd Sec.Direct Cost 2022",
]);

function splitLabel(name: string): [string, string] {
  const words = name.split(" ");
  if (words.length <= 2) return [words[0], words.slice(1).join(" ")];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

// Pointy-top hexagon matching d3-hexbin orientation
function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${cx + Math.sin(a) * r},${cy - Math.cos(a) * r}`;
  }).join(" ");
}

export default function ImpactMap({ projects, variant = "flat" }: Props) {
  const [tileData, setTileData] = useState<TileData | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [locked, setLocked] = useState<string | null>(null);

  // locked takes priority over hover
  const activeRegion = locked ?? hovered ?? "Global";

  useEffect(() => {
    fetch("/data/hex-tiles.json")
      .then((r) => r.json())
      .then(setTileData);
  }, []);

  const filteredProjects = useMemo(
    () =>
      projects.filter(
        (p) =>
          p.project_short_title &&
          !EXCLUDED_PROJECTS.has(p.project_short_title),
      ),
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

  function densityFill(region: string): string {
    if (!regionDensity) return "rgba(255,255,255,0.28)";
    const { map, globalCount, maxDensity } = regionDensity;
    const count = map.get(region) ?? globalCount;
    const t = maxDensity === globalCount ? 0 : (count - globalCount) / (maxDensity - globalCount);
    return lerpHex(DENSITY_LOW, DENSITY_HIGH, t);
  }

  const regionCentroids = useMemo(() => {
    if (!tileData) return new Map<string, [number, number]>();
    const sums = new Map<string, { x: number; y: number; n: number }>();
    for (const t of tileData.tiles) {
      const s = sums.get(t.region) ?? { x: 0, y: 0, n: 0 };
      s.x += t.x;
      s.y += t.y;
      s.n += 1;
      sums.set(t.region, s);
    }
    const out = new Map<string, [number, number]>();
    for (const [r, s] of sums) out.set(r, [s.x / s.n, s.y / s.n]);
    return out;
  }, [tileData]);

  function isHighlighted(region: string): boolean {
    if (locked) return region === locked;
    return region === hovered;
  }

  function handleTileClick(e: React.MouseEvent, region: string) {
    e.stopPropagation();
    setLocked((prev) => (prev === region ? null : region));
  }

  const globalProjects = projectsByRegion.get("Global") ?? [];
  const isSelected = locked !== null || hovered !== null;
  const regionalProjects = isSelected
    ? (projectsByRegion.get(activeRegion) ?? [])
    : [];
  const hasRegional = regionalProjects.length > 0;

  const drawR = tileData ? tileData.hexRadius * 0.96 : 9;

  if (!tileData) return <div className={styles.root} />;

  return (
    <div className={styles.root} onClick={() => setLocked(null)}>
      <svg
        className={styles.svg}
        viewBox={`0 -30 ${tileData.width} ${tileData.height + 30}`}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
        style={{ overflow: "visible" }}
      >
        <rect
          x={-60}
          y={-60}
          width={tileData.width + 120}
          height={tileData.height + 120}
          fill="#F1B434"
        />

        {/* Tiles */}
        {Array.from(new Set(tileData.tiles.map((t) => t.region))).map((region) => {
          const hl = isHighlighted(region);
          const isLock = locked === region;
          return (
            <g
              key={region}
              onMouseEnter={() => setHovered(region)}
              onMouseLeave={() => setHovered(null)}
              onClick={(e) => handleTileClick(e, region)}
              style={{ cursor: "pointer" }}
            >
              {tileData.tiles
                .filter((t) => t.region === region)
                .map((t, i) => (
                  <polygon
                    key={i}
                    points={hexPoints(t.x, t.y, drawR)}
                    fill={hl ? "rgba(255,255,255,0.80)" : densityFill(region)}
                    stroke={variant === "density"
                      ? (isLock ? "rgba(68,42,10,0.5)" : hl ? "rgba(68,42,10,0.6)" : "none")
                      : (isLock ? "rgba(68,42,10,0.7)" : hl ? "rgba(68,42,10,0.45)" : "rgba(255,255,255,0.30)")}
                    strokeWidth={variant === "density"
                      ? (isLock ? 2 : hl ? 1.5 : 0)
                      : (isLock ? 2 : hl ? 1.6 : 0.8)}
                    style={{ transition: "fill 140ms ease, stroke 140ms ease" }}
                  />
                ))}
            </g>
          );
        })}

        {/* Region labels with white bg on highlight */}
        {Array.from(regionCentroids.entries()).map(([region, [cx, cy]]) => {
          const [line1, line2] = splitLabel(region);
          const hl = isHighlighted(region);
          const maxLen = Math.max(line1.length, line2?.length ?? 0);
          const bgW = maxLen * 9 + 18;
          const bgH = line2 ? 40 : 27;
          return (
            <g
              key={region}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {hl && (
                <rect
                  x={cx - bgW / 2}
                  y={cy - (line2 ? 20 : 23)}
                  width={bgW}
                  height={bgH}
                  rx={5}
                  fill={variant === "density" ? "#FDF7EA" : "rgba(255,255,255,0.88)"}
                />
              )}
              <text
                textAnchor="middle"
                fontFamily="Roboto, sans-serif"
                fontWeight={500}
                fontSize={14}
                letterSpacing={0.5}
                fill={variant === "density" ? "#BC840F" : (hl ? "rgba(68,42,10,0.95)" : "rgba(68,42,10,0.52)")}
                stroke={variant === "density" ? "rgba(68,42,10,0.65)" : undefined}
                strokeWidth={variant === "density" ? 0.5 : undefined}
                style={variant === "density" ? { paintOrder: "stroke fill" } : undefined}
              >
                <tspan x={cx} y={cy - 5}>{line1}</tspan>
                {line2 && <tspan x={cx} dy={16}>{line2}</tspan>}
              </text>
            </g>
          );
        })}
      </svg>

      {/* ── Modal ────────────────────────────────────────── */}
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        {/* Zone 1 — region identity (always present) */}
        <div className={styles.zoneLeft}>
          {isSelected ? (
            <>
              <p className={styles.zoneEyebrow}>Selected region</p>
              <h2 className={styles.zoneTitle}>{activeRegion}</h2>
              {locked && (
                <button
                  className={styles.unlockBtn}
                  onClick={() => setLocked(null)}
                >
                  ✕ Unlock
                </button>
              )}
            </>
          ) : (
            <>
              <p className={styles.zoneEyebrow}>Worldwide</p>
              <h2 className={styles.zoneTitle}>Global view</h2>
              <p className={styles.zoneHint}>
                Hover or click a region to explore
              </p>
            </>
          )}
        </div>

        <div className={styles.zoneDivider} />

        {/* Zone 2 — regional projects (only when a region is selected) */}
        {isSelected && (
          <>
            <div className={styles.zoneMiddle}>
              <p className={styles.zoneLabel}>In this region</p>
              {hasRegional ? (
                <ul className={styles.projectList}>
                  {regionalProjects.map((p) => (
                    <li
                      key={p.project_short_title}
                      className={styles.projectBlock}
                    >
                      {p.project_url ? (
                        <a
                          href={p.project_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {p.project_short_title}
                        </a>
                      ) : (
                        <span>{p.project_short_title}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.emptyState}>
                  No targeted projects in this region
                </p>
              )}
            </div>
            <div className={styles.zoneDivider} />
          </>
        )}

        {/* Zone 3 — global projects (always present) */}
        <div className={styles.zoneRight}>
          <p className={styles.zoneLabel}>Global</p>
          <ul className={styles.projectList}>
            {globalProjects.map((p) => (
              <li key={p.project_short_title} className={styles.projectBlock}>
                {p.project_url ? (
                  <a href={p.project_url} target="_blank" rel="noreferrer">
                    {p.project_short_title}
                  </a>
                ) : (
                  <span>{p.project_short_title}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
