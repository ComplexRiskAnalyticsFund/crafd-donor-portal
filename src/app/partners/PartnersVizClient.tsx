"use client";

// src/app/partners/PartnersVizClient.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import gsap from "gsap";
import type { HexNode } from "@/lib/partners/label";

const SQRT3 = Math.sqrt(3);
const HEX_SIZE = 75;
const GRID_LIMIT = 2400;

function clampPan(x: number, y: number, s: number) {
  const maxX = Math.max(0, GRID_LIMIT * s - 900);
  const maxY = Math.max(0, GRID_LIMIT * s - 500);
  return {
    x: Math.max(-maxX, Math.min(maxX, x)),
    y: Math.max(-maxY, Math.min(maxY, y)),
  };
}

function toLogoSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/\//g, "-")
    .replace(/_/g, "-")
    .replace(/&/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "")
    .replace(/,/g, "");
}

function hexPathFlat(cx: number, cy: number, r: number) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  return `M ${pts.map((p) => p.join(",")).join(" L ")} Z`;
}

function fillFor(n: HexNode, highlight: "primary" | "secondary" | null = null) {
  if (n.kind === "center") return "white";
  if (n.kind === "label") return "#FFD89C";
  if (n.kind === "outline") return "none";
  if (n.kind === "partner" && n.label === "donor") return "white";
  if (highlight === "primary") return "#000000";
  if (highlight === "secondary") return "#000000";
  return "#1C1C1C";
}

function strokeFor(n: HexNode): string {
  if (n.kind === "partner" && n.label === "donor") return "#F1B434";
  return "white";
}

function strokeWidthFor(n: HexNode) {
  if (n.kind === "center") return 0;
  return 2;
}

// ── Stat card used in click state 2 ───────────────────────────────────────────
function StatCard({
  label,
  children,
  accent = false,
}: {
  label: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 12,
        padding: "1rem 1.1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <p
        style={{
          fontSize: "0.65rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.5)",
          margin: 0,
        }}
      >
        {label}
      </p>
      {accent && (
        <div style={{ width: 36, height: 3, background: "#cc3333", borderRadius: 2 }} />
      )}
      <div style={{ color: "white" }}>{children}</div>
    </div>
  );
}

export default function PartnersVizClient({
  initialNodes,
  availableSlugs,
}: {
  initialNodes: HexNode[];
  availableSlugs: string[];
}) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [hoveredPartner, setHoveredPartner] = useState<string | null>(null);
  const [renderNodes, setRenderNodes] = useState<HexNode[]>([]);
  const [lockedGroup, setLockedGroup] = useState<Set<string> | null>(null);
  // relational_feature string for the currently locked group (needed for URL sync)
  const [lockedFeature, setLockedFeature] = useState<string | null>(null);
  // click state 2 — individual partner detail
  const [clickedNode, setClickedNode] = useState<HexNode | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const panRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  const MIN_SCALE = 0.4;
  const MAX_SCALE = 2;

  useEffect(() => { setRenderNodes(initialNodes); }, [initialNodes]);

  // Restore modal state from URL on mount (enables shareable links)
  useEffect(() => {
    const groupParam = searchParams.get("group");
    const partnerParam = searchParams.get("partner");
    if (groupParam) {
      const peers = new Set(
        initialNodes
          .filter((n) => n.kind === "partner" && n.partner?.relational_feature === groupParam)
          .map((n) => n.id),
      );
      if (peers.size > 0) { setLockedGroup(peers); setLockedFeature(groupParam); }
    }
    if (partnerParam) {
      const node = initialNodes.find(
        (n) => n.kind === "partner" && (n.partner?.org_short_name ?? n.name) === partnerParam,
      );
      if (node) setClickedNode(node);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pop-in animation
  useEffect(() => {
    if (renderNodes.length === 0) return;
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => {
      const partnerGs = Array.from(svgEl.querySelectorAll<SVGGElement>('[data-kind="partner"]'));
      if (partnerGs.length === 0) return;
      partnerGs.forEach((el) => {
        const cx = el.getAttribute("data-cx") ?? "0";
        const cy = el.getAttribute("data-cy") ?? "0";
        gsap.set(el, { opacity: 0, scale: 0, svgOrigin: `${cx} ${cy}` });
      });
      gsap.to(partnerGs, {
        opacity: 1, scale: 1, duration: 0.5, stagger: 0.04, ease: "back.out(1.7)",
        onComplete: () => { gsap.set(partnerGs, { clearProps: "transform,transformOrigin" }); },
      });
    }));
    return () => { cancelAnimationFrame(id); gsap.killTweensOf('[data-kind="partner"]'); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderNodes.length]);

  // Pan (two-finger) + zoom (pinch/Ctrl+scroll)
  // Attached to window so it works even when click-state-1 modal overlay is present.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const el = svgRef.current;
      if (!el) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey) {
        const cursorSvgX = ((e.clientX - rect.left) / rect.width) * 1800 - 900;
        const cursorSvgY = ((e.clientY - rect.top) / rect.height) * 1000 - 500;
        const cx = (cursorSvgX - panRef.current.x) / scaleRef.current;
        const cy = (cursorSvgY - panRef.current.y) / scaleRef.current;
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scaleRef.current * factor));
        setPan(clampPan(cursorSvgX - cx * newScale, cursorSvgY - cy * newScale, newScale));
        setScale(newScale);
      } else {
        const px2unit = (1800 / rect.width) / scaleRef.current;
        setPan((p) => clampPan(p.x - e.deltaX * px2unit, p.y - e.deltaY * px2unit, scaleRef.current));
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  // Keyboard: arrows pan, +/- zoom, R reset, Escape dismisses modals outward
  useEffect(() => {
    const PAN_STEP = 50;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (clickedNode) {
          setClickedNode(null);
          if (lockedFeature) router.replace(`${pathname}?group=${encodeURIComponent(lockedFeature)}`);
          else router.replace(pathname);
          return;
        }
        setLockedGroup(null); setLockedFeature(null); router.replace(pathname); return;
      }
      if (e.key === "ArrowLeft")       setPan((p) => clampPan(p.x + PAN_STEP, p.y, scaleRef.current));
      else if (e.key === "ArrowRight") setPan((p) => clampPan(p.x - PAN_STEP, p.y, scaleRef.current));
      else if (e.key === "ArrowUp")    setPan((p) => clampPan(p.x, p.y + PAN_STEP, scaleRef.current));
      else if (e.key === "ArrowDown")  setPan((p) => clampPan(p.x, p.y - PAN_STEP, scaleRef.current));
      else if (e.key === "+" || e.key === "=") setScale((s) => Math.min(MAX_SCALE, s * 1.15));
      else if (e.key === "-")          setScale((s) => Math.max(MIN_SCALE, s / 1.15));
      else if (e.key === "r" || e.key === "R") { setPan({ x: 0, y: 0 }); setScale(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clickedNode, lockedFeature, router, pathname]);

  function handleDoubleClick() { setPan({ x: 0, y: 0 }); setScale(1); }

  // Enter click state 1: lock the relational group of this partner
  function enterClickState1(n: HexNode) {
    const rf = n.partner?.relational_feature;
    if (!rf) return;
    const peers = new Set(
      renderNodes
        .filter(node => node.kind === "partner" && node.id !== n.id && node.partner?.relational_feature === rf)
        .map(node => node.id),
    );
    if (peers.size === 0) return;
    setHoveredPartner(null);
    setHoveredLabel(null);
    setLockedGroup(new Set([n.id, ...peers]));
    setLockedFeature(rf);
    router.replace(`${pathname}?group=${encodeURIComponent(rf)}`);
  }

  const bgHexes = useMemo(() => {
    const FADE_START = 200;
    const FADE_END = 2400;
    const cells: { x: number; y: number; key: string; opacity: number }[] = [];
    for (let q = -28; q <= 28; q++) {
      for (let r = -28; r <= 28; r++) {
        const x = HEX_SIZE * 1.5 * q;
        const y = HEX_SIZE * SQRT3 * (r + q / 2);
        const dist = Math.sqrt(x * x + y * y);
        if (dist > FADE_END) continue;
        const t = Math.max(0, (dist - FADE_START) / (FADE_END - FADE_START));
        cells.push({ x, y, key: `bg-${q}-${r}`, opacity: 0.9 * (1 - t) });
      }
    }
    return cells;
  }, []);

  const slugSet = useMemo(() => new Set(availableSlugs), [availableSlugs]);

  const hoveredPartnerNode = useMemo(
    () => (hoveredPartner ? renderNodes.find((n) => n.id === hoveredPartner) ?? null : null),
    [hoveredPartner, renderNodes],
  );

  const relationalPeers = useMemo(() => {
    const rf = hoveredPartnerNode?.partner?.relational_feature;
    if (!rf) return new Set<string>();
    return new Set(
      renderNodes
        .filter((n) => n.kind === "partner" && n.id !== hoveredPartnerNode!.id && n.partner?.relational_feature === rf)
        .map((n) => n.id),
    );
  }, [hoveredPartnerNode, renderNodes]);

  const ordered = useMemo(() => {
    function priority(n: HexNode): number {
      if (lockedGroup !== null && n.kind === "partner" && lockedGroup.has(n.id)) return 100;
      if (hoveredPartnerNode && n.kind === "partner") {
        if (n.id === hoveredPartnerNode.id) return 100;
        if (relationalPeers.has(n.id)) return 50;
      }
      const base: Record<HexNode["kind"], number> = { outline: 0, partner: 1, label: 2, center: 3 };
      return base[n.kind];
    }
    return [...renderNodes].sort((a, b) => priority(a) - priority(b));
  }, [renderNodes, hoveredPartnerNode, relationalPeers, lockedGroup]);

  const lockedNodes = useMemo(
    () => lockedGroup ? renderNodes.filter(n => n.kind === "partner" && lockedGroup.has(n.id)) : [],
    [lockedGroup, renderNodes],
  );

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        viewBox="-900 -500 1800 1000"
        className="h-full w-full"
        style={{ cursor: "default" }}
        onDoubleClick={handleDoubleClick}
      >
        {/*
          SVG backdrop rect — spans the full viewBox, drawn BEFORE the pan/scale group
          (so hexes above it in z-order still receive clicks first).
          Handles click-to-exit click state 1 without an HTML overlay div.
        */}
        {lockedGroup !== null && (
          <rect
            x="-900" y="-500" width="1800" height="1000"
            fill="transparent"
            style={{ cursor: "default" }}
            onClick={() => { setLockedGroup(null); setLockedFeature(null); setClickedNode(null); router.replace(pathname); }}
          />
        )}

        <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
          {/* Background hex grid */}
          {bgHexes.map(({ x, y, key, opacity }) => (
            <path
              key={key}
              d={hexPathFlat(x, y, HEX_SIZE)}
              fill="none"
              stroke="white"
              strokeWidth={1.5}
              strokeOpacity={opacity * (lockedGroup !== null ? 0.18 : 1)}
            />
          ))}

          {/* Connecting lines — black, drawn under hexes, edge-to-edge */}
          {lockedGroup !== null && lockedNodes.map((a, i) =>
            lockedNodes.slice(i + 1).map((b) => {
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist === 0) return null;
              const ux = dx / dist;
              const uy = dy / dist;
              return (
                <line
                  key={`conn-${a.id}-${b.id}`}
                  x1={a.x + ux * a.r} y1={a.y + uy * a.r}
                  x2={b.x - ux * b.r} y2={b.y - uy * b.r}
                  stroke="black"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              );
            })
          )}

          {ordered.map((n) => {
            let nodeOpacity = n.kind === "partner" ? 0.95 : 1;
            let nodeScale = 1;
            let highlight: "primary" | "secondary" | null = null;

            if (lockedGroup !== null) {
              if (n.kind === "outline") {
                nodeOpacity = 0.1;
              } else if (n.kind === "center") {
                nodeOpacity = 0.18;
              } else if (n.kind === "label") {
                nodeOpacity = 0.07;
              } else {
                if (lockedGroup.has(n.id)) {
                  nodeOpacity = 1;
                  nodeScale = 1.15;
                } else {
                  nodeOpacity = 0.07;
                }
              }
            } else if (hoveredPartner !== null && hoveredPartnerNode) {
              if (n.kind === "outline" || n.kind === "center") {
                // unchanged
              } else if (n.kind === "label") {
                nodeOpacity = 0.4;
              } else {
                const rf = hoveredPartnerNode.partner?.relational_feature;
                if (n.id === hoveredPartnerNode.id) {
                  nodeScale = 1.5; nodeOpacity = 1; highlight = "primary";
                } else if (rf && n.partner?.relational_feature === rf) {
                  nodeOpacity = 1; highlight = "secondary";
                } else {
                  nodeOpacity = 0.35;
                }
              }
            } else if (hoveredLabel !== null) {
              const isSameGroup = (n.kind === "label" || n.kind === "partner") && n.label === hoveredLabel;
              if (n.kind === "outline" || n.kind === "center") {
                nodeOpacity = 1;
              } else if (isSameGroup) {
                nodeOpacity = n.kind === "partner" ? 0.9 : 1;
              } else {
                nodeOpacity = 0.2;
              }
            }

            // ── Non-partner nodes ──────────────────────────────────────────────
            if (n.kind !== "partner") {
              return (
                <g
                  key={n.id}
                  data-node="true"
                  data-kind={n.kind}
                  onMouseEnter={() => {
                    if (lockedGroup) return;
                    if (n.kind === "label") setHoveredLabel(n.label ?? null);
                  }}
                  onMouseLeave={() => {
                    if (lockedGroup) return;
                    if (n.kind === "label") setHoveredLabel(null);
                  }}
                  style={{
                    opacity: nodeOpacity,
                    transition: "opacity 0.45s ease",
                    cursor: n.kind === "label" ? "pointer" : "default",
                  }}
                >
                  <path
                    d={hexPathFlat(n.x, n.y, n.r)}
                    fill={fillFor(n, highlight)}
                    stroke={strokeFor(n)}
                    strokeWidth={strokeWidthFor(n)}
                  />
                  {n.kind === "center" && (
                    <image
                      href="/logos/craf'd.png"
                      x={n.x - n.r * 0.55}
                      y={n.y - n.r * 0.32}
                      width={n.r * 1.1}
                      height={n.r * 0.64}
                      preserveAspectRatio="xMidYMid meet"
                    />
                  )}
                  {n.kind === "label" && (
                    <>
                      <text x={n.x} y={n.y - 4} textAnchor="middle" fontSize="42" fill="black" fontWeight={1000} fontFamily="inherit">
                        {n.count}
                      </text>
                      {n.name?.split("\n").map((line, idx) => (
                        <text key={idx} x={n.x} y={n.y + 20 + idx * 13} textAnchor="middle" fontSize="12" fill="black" fontWeight={1000}>
                          {line}
                        </text>
                      ))}
                    </>
                  )}
                </g>
              );
            }

            // ── Partner nodes: three nested <g> for reliable scale anchoring ──
            const slug = toLogoSlug(n.partner?.org_short_name ?? n.name ?? "");
            const boxW = n.r * 0.72;
            const boxH = n.r * 0.62;
            const isLocked = lockedGroup?.has(n.id) ?? false;

            return (
              <g
                key={n.id}
                data-node="true"
                data-kind="partner"
                data-cx={n.x}
                data-cy={n.y}
                onMouseEnter={() => {
                  if (lockedGroup) return;
                  setHoveredPartner(n.id);
                }}
                onMouseLeave={() => {
                  if (lockedGroup) return;
                  setHoveredPartner(null);
                }}
                onClick={(e) => {
                  e.stopPropagation(); // prevent SVG backdrop rect from firing
                  const slug = encodeURIComponent(n.partner?.org_short_name ?? n.name ?? "");
                  if (lockedGroup !== null) {
                    if (isLocked) {
                      setClickedNode(n);
                      const qs = lockedFeature
                        ? `?group=${encodeURIComponent(lockedFeature)}&partner=${slug}`
                        : `?partner=${slug}`;
                      router.replace(`${pathname}${qs}`);
                    }
                  } else {
                    const rf = n.partner?.relational_feature;
                    const hasPeers = rf && renderNodes.some(
                      node => node.kind === "partner" && node.id !== n.id && node.partner?.relational_feature === rf,
                    );
                    if (hasPeers) {
                      enterClickState1(n); // enterClickState1 handles URL
                    } else {
                      setClickedNode(n);
                      router.replace(`${pathname}?partner=${slug}`);
                    }
                  }
                }}
                style={{
                  opacity: nodeOpacity,
                  transition: "opacity 0.45s ease",
                  cursor: lockedGroup !== null ? (isLocked ? "pointer" : "default") : "pointer",
                }}
              >
                {/* SVG translate: positions origin at hex center */}
                <g transform={`translate(${n.x},${n.y})`}>
                  {/* CSS scale: origin (0,0) = hex center → always anchored correctly */}
                  <g
                    style={{
                      transformOrigin: "0 0",
                      transform: nodeScale !== 1 ? `scale(${nodeScale})` : undefined,
                      transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
                    }}
                  >
                    <path
                      d={hexPathFlat(0, 0, n.r)}
                      fill={fillFor(n, highlight)}
                      stroke={strokeFor(n)}
                      strokeWidth={strokeWidthFor(n)}
                    />
                    {n.label === "donor" ? (
                      <>
                        <image href={`/logos/countries/${slug}.svg`} x={-boxW / 2} y={-boxH / 2} width={boxW} height={boxH} preserveAspectRatio="xMidYMid meet" />
                        {hoveredPartner === n.id && n.name && (
                          <text x={0} y={boxH / 2 + 14} textAnchor="middle" fontSize={9} fill="#1C1C1C" fontWeight={700}>{n.name}</text>
                        )}
                      </>
                    ) : slugSet.has(slug) ? (
                      <>
                        <image href={`/white_logos/${slug}.png`} x={-boxW / 2} y={-boxH / 2} width={boxW} height={boxH} preserveAspectRatio="xMidYMid meet" />
                        {hoveredPartner === n.id && n.name && (
                          <text x={0} y={boxH / 2 + 14} textAnchor="middle" fontSize={9} fill="white" fontWeight={700}>{n.name}</text>
                        )}
                      </>
                    ) : n.name ? (
                      <text x={0} y={4} textAnchor="middle" fontSize={12} fill="white">{n.name}</text>
                    ) : null}
                  </g>
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      {/* ── Click state 1 overlay ────────────────────────────────────────────────
          pointer-events: none on outer div so wheel/click events pass through
          to the SVG for pan/zoom and the SVG backdrop rect for close-on-click.
          Only the left panel is interactive (pointer-events: all).
      */}
      {lockedGroup && !clickedNode && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", pointerEvents: "none" }}>
          <div
            style={{
              width: 380,
              pointerEvents: "all",
              background: "rgba(8,8,8,0.93)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderRight: "1px solid rgba(255,255,255,0.08)",
              color: "white",
              display: "flex",
              flexDirection: "column",
              padding: "2.5rem",
              gap: "1.25rem",
              overflowY: "auto",
            }}
          >
            <button
              onClick={() => { setLockedGroup(null); setLockedFeature(null); setClickedNode(null); router.replace(pathname); }}
              style={{
                alignSelf: "flex-end", background: "none",
                border: "1px solid rgba(255,255,255,0.2)", borderRadius: "50%",
                color: "white", width: 32, height: 32, fontSize: "1.1rem",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >×</button>

            <p style={{ fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#F1B434", margin: 0 }}>
              Relational Ecosystem
            </p>
            <h2 style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1.2, margin: 0 }}>
              {lockedGroup.size} Connected Partners
            </h2>
            <div style={{ width: 40, height: 2, background: "#F1B434", borderRadius: 1 }} />
            <p style={{ fontSize: "0.92rem", lineHeight: 1.75, opacity: 0.8, margin: 0 }}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
            </p>
            <p style={{ fontSize: "0.92rem", lineHeight: 1.75, opacity: 0.55, margin: 0 }}>
              Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
            </p>
            <p style={{ fontSize: "0.78rem", opacity: 0.4, margin: 0, lineHeight: 1.6 }}>
              Click a highlighted partner to explore its details.
            </p>
          </div>
        </div>
      )}

      {/* ── Click state 2 — partner detail modal ──────────────────────────────── */}
      {clickedNode && (() => {
        const p = clickedNode.partner;
        const name = p?.org_short_name?.trim() ?? clickedNode.name ?? "Partner";
        const fullName = p?.org_full_name?.trim() ?? "";
        const connection = p?.crafd_connection ?? "";
        const logoSlug = toLogoSlug(name);
        const hasLogo = slugSet.has(logoSlug);

        return (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 60,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(0,0,0,0.72)",
              padding: "1.5rem",
            }}
            onClick={() => {
              setClickedNode(null);
              if (lockedFeature) router.replace(`${pathname}?group=${encodeURIComponent(lockedFeature)}`);
              else router.replace(pathname);
            }} // click backdrop to close
          >
            <div
              style={{
                background: "#141414",
                borderRadius: 18,
                maxWidth: 920,
                width: "100%",
                position: "relative",
                padding: "2.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1.75rem",
                maxHeight: "90vh",
                overflowY: "auto",
              }}
              onClick={(e) => e.stopPropagation()} // don't close when clicking card
            >
              {/* Close */}
              <button
                onClick={() => {
                  setClickedNode(null);
                  if (lockedFeature) router.replace(`${pathname}?group=${encodeURIComponent(lockedFeature)}`);
                  else router.replace(pathname);
                }}
                style={{
                  position: "absolute", top: 20, right: 20,
                  background: "none", border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "50%", color: "white", width: 36, height: 36,
                  fontSize: "1.2rem", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >×</button>

              {/* Header row: logo + title */}
              <div style={{ display: "flex", gap: "1.75rem", alignItems: "flex-start", paddingRight: "3rem" }}>
                {/* Logo box */}
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                  <div
                    style={{
                      width: 80, height: 80,
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 10,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "rgba(255,255,255,0.05)",
                      overflow: "hidden",
                    }}
                  >
                    {hasLogo ? (
                      <img
                        src={`/white_logos/${logoSlug}.png`}
                        alt={name}
                        style={{ width: "72%", height: "72%", objectFit: "contain" }}
                      />
                    ) : (
                      <span style={{ color: "white", fontWeight: 800, fontSize: "0.8rem", textAlign: "center", padding: "0.25rem" }}>
                        {name}
                      </span>
                    )}
                  </div>
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.72rem", letterSpacing: "0.06em", margin: 0, textAlign: "center" }}>
                    {name}
                  </p>
                </div>

                {/* Title + description */}
                <div style={{ flex: 1 }}>
                  <h1 style={{
                    color: "white", fontWeight: 800,
                    fontSize: "clamp(1.2rem, 2.5vw, 1.75rem)",
                    lineHeight: 1.15, margin: "0 0 1rem",
                    textTransform: "uppercase", letterSpacing: "0.02em",
                  }}>
                    {name}{fullName ? `: ${fullName}` : ""}
                  </h1>
                  <p style={{ color: "rgba(255,255,255,0.72)", fontSize: "0.9rem", lineHeight: 1.75, margin: 0 }}>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. CRAF&apos;d partners reaffirmed their commitment to this organisation, enabling growth in reach, partnerships, and impact across crisis-affected communities worldwide.
                  </p>
                </div>
              </div>

              {/* Stat cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr 1fr", gap: "0.9rem" }}>
                <StatCard label="Status" accent>
                  <p style={{ fontWeight: 800, fontSize: "0.9rem", margin: 0, textTransform: "uppercase", lineHeight: 1.3 }}>
                    {connection || "Active"}
                  </p>
                </StatCard>

                <StatCard label="Coverage">
                  <div
                    style={{
                      height: 80, background: "#0a0a0a", borderRadius: 6,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.7rem", margin: 0 }}>Map placeholder</p>
                  </div>
                </StatCard>

                <StatCard label="Grant Size:">
                  <p style={{ fontWeight: 800, fontSize: "1.8rem", margin: 0, lineHeight: 1 }}>TBD</p>
                </StatCard>

                <StatCard label="Project Duration:">
                  <p style={{ fontWeight: 800, fontSize: "1.8rem", margin: 0, lineHeight: 1 }}>TBD</p>
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", margin: 0 }}>MONTHS</p>
                </StatCard>
              </div>

              {/* CTA buttons */}
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                {["Project Overview", "Project Impact", "MPTFO Page"].map((label) => (
                  <button
                    key={label}
                    style={{
                      background: "#F1B434", color: "#000", fontWeight: 800,
                      fontSize: "0.78rem", letterSpacing: "0.08em",
                      textTransform: "uppercase", border: "none", borderRadius: 6,
                      padding: "0.75rem 1.4rem", cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
