"use client";

// src/app/partners/PartnersVizClient.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import type { HexNode } from "@/lib/partners/label";

const SQRT3 = Math.sqrt(3);
const HEX_SIZE = 75;
const HEX_SPACING = SQRT3 * HEX_SIZE; // ≈ 129.9 — distance between adjacent hex centers

// ─── HOVER MODE ───────────────────────────────────────────────────────────────
// To switch hover style, uncomment ONE line and comment the others:
// const HOVER_MODE: "wave" | "relational" | "constellation" = "wave";
const HOVER_MODE: "wave" | "relational" | "constellation" = "relational";
// const HOVER_MODE: "wave" | "relational" | "constellation" = "constellation";
// ─────────────────────────────────────────────────────────────────────────────

function hexPathFlat(cx: number, cy: number, r: number) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i; // flat-top
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  return `M ${pts.map((p) => p.join(",")).join(" L ")} Z`;
}

function fillFor(n: HexNode, highlight: "primary" | "secondary" | null = null) {
  if (n.kind === "center") return "white";
  if (n.kind === "label") return "#FFD89C";
  if (n.kind === "outline") return "none";
  if (highlight === "primary") return "#000000";   // hovered partner — brand yellow
  if (highlight === "secondary") return "#000000"; // related partner — deep amber
  return "#1C1C1C";
}

function strokeWidthFor(n: HexNode) {
  if (n.kind === "center") return 0;
  return 2;
}

export default function PartnersVizClient({
  initialNodes,
}: {
  initialNodes: HexNode[];
}) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [hoveredPartner, setHoveredPartner] = useState<string | null>(null);
  // Start with empty nodes on server to avoid SSR/client floating-point mismatch
  // in trig functions (Math.cos/sin differ between Node.js and browser engines).
  // The GSAP effect populates nodes immediately on mount anyway.
  const [renderNodes, setRenderNodes] = useState<HexNode[]>([]);

  // Pan + zoom state
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const panRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  const MIN_SCALE = 0.4;
  const MAX_SCALE = 2;

  // Populate nodes immediately at their final positions (no fly-in needed)
  useEffect(() => {
    setRenderNodes(initialNodes);
  }, [initialNodes]);

  // Pop-in animation: each partner grows from 0 to full size with a bounce
  useEffect(() => {
    if (renderNodes.length === 0) return;
    const svgEl = svgRef.current;
    if (!svgEl) return;
    // Double-RAF ensures React has committed the nodes to the DOM
    const id = requestAnimationFrame(() => requestAnimationFrame(() => {
      const partnerGs = Array.from(
        svgEl.querySelectorAll<SVGGElement>('[data-kind="partner"]'),
      );
      if (partnerGs.length === 0) return;
      gsap.set(partnerGs, {
        opacity: 0, scale: 0,
        transformBox: "fill-box", transformOrigin: "50% 50%",
      });
      gsap.to(partnerGs, {
        opacity: 1, scale: 1,
        duration: 0.5,
        stagger: 0.04,
        ease: "back.out(1.7)",
      });
    }));
    return () => {
      cancelAnimationFrame(id);
      gsap.killTweensOf('[data-kind="partner"]');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderNodes.length]);

  // Pan: two-finger trackpad swipe (wheel without ctrlKey)
  // Zoom: pinch or Ctrl+scroll (wheel with ctrlKey)
  useEffect(() => {
    const el = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        // Pinch-to-zoom
        const rect = el.getBoundingClientRect();
        const cursorSvgX = ((e.clientX - rect.left) / rect.width) * 1800 - 900;
        const cursorSvgY = ((e.clientY - rect.top) / rect.height) * 1000 - 500;
        const cx = (cursorSvgX - panRef.current.x) / scaleRef.current;
        const cy = (cursorSvgY - panRef.current.y) / scaleRef.current;
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scaleRef.current * factor));
        setPan({ x: cursorSvgX - cx * newScale, y: cursorSvgY - cy * newScale });
        setScale(newScale);
      } else {
        // Two-finger swipe to pan
        const rect = el.getBoundingClientRect();
        const px2unit = (1800 / rect.width) / scaleRef.current;
        setPan((p) => ({ x: p.x - e.deltaX * px2unit, y: p.y - e.deltaY * px2unit }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Keyboard pan (arrows) + zoom (+/-) + reset (R/double-click)
  useEffect(() => {
    const PAN_STEP = 50;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")       setPan((p) => ({ ...p, x: p.x + PAN_STEP }));
      else if (e.key === "ArrowRight") setPan((p) => ({ ...p, x: p.x - PAN_STEP }));
      else if (e.key === "ArrowUp")    setPan((p) => ({ ...p, y: p.y + PAN_STEP }));
      else if (e.key === "ArrowDown")  setPan((p) => ({ ...p, y: p.y - PAN_STEP }));
      else if (e.key === "+" || e.key === "=") setScale((s) => Math.min(MAX_SCALE, s * 1.15));
      else if (e.key === "-")          setScale((s) => Math.max(MIN_SCALE, s / 1.15));
      else if (e.key === "r" || e.key === "R") { setPan({ x: 0, y: 0 }); setScale(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleDoubleClick() {
    setPan({ x: 0, y: 0 });
    setScale(1);
  }

  // Background hex grid — extended coverage with edge fade
  const bgHexes = useMemo(() => {
    const FADE_START = 600;
    const FADE_END = 2400;
    const cells: { x: number; y: number; key: string; opacity: number }[] = [];
    for (let q = -28; q <= 28; q++) {
      for (let r = -28; r <= 28; r++) {
        const x = HEX_SIZE * 1.5 * q;
        const y = HEX_SIZE * SQRT3 * (r + q / 2);
        const dist = Math.sqrt(x * x + y * y);
        if (dist > FADE_END) continue;
        const t = Math.max(0, (dist - FADE_START) / (FADE_END - FADE_START));
        cells.push({ x, y, key: `bg-${q}-${r}`, opacity: 0.28 * (1 - t) });
      }
    }
    return cells;
  }, []);

  const hoveredPartnerNode = useMemo(
    () => (hoveredPartner ? renderNodes.find((n) => n.id === hoveredPartner) ?? null : null),
    [hoveredPartner, renderNodes],
  );

  // IDs of partners sharing relational_feature with the hovered partner
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
      if (hoveredPartnerNode && n.kind === "partner") {
        if (n.id === hoveredPartnerNode.id) return 100;
        if (HOVER_MODE === "wave") {
          const dx = n.x - hoveredPartnerNode.x;
          const dy = n.y - hoveredPartnerNode.y;
          if (Math.sqrt(dx * dx + dy * dy) < HEX_SPACING * 1.5) return 50;
        } else if (relationalPeers.has(n.id)) {
          return 50;
        }
      }
      const base: Record<HexNode["kind"], number> = { outline: 0, partner: 1, label: 2, center: 3 };
      return base[n.kind];
    }
    return [...renderNodes].sort((a, b) => priority(a) - priority(b));
  }, [renderNodes, hoveredPartnerNode, relationalPeers]);

  return (
    <svg
      ref={svgRef}
      viewBox="-900 -500 1800 1000"
      className="h-full w-full"
      style={{ cursor: "default" }}
      onDoubleClick={handleDoubleClick}
    >
      <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
        {/* Background hex grid — fades toward edges */}
        {bgHexes.map(({ x, y, key, opacity }) => (
          <path
            key={key}
            d={hexPathFlat(x, y, HEX_SIZE)}
            fill="none"
            stroke="white"
            strokeWidth={1.5}
            strokeOpacity={opacity}
          />
        ))}

        {/* Mode 3 — constellation lines from hovered partner to relational peers */}
        {HOVER_MODE === "constellation" && hoveredPartnerNode &&
          [...relationalPeers].map((peerId) => {
            const peer = renderNodes.find((n) => n.id === peerId);
            if (!peer) return null;
            return (
              <line
                key={`line-${peerId}`}
                x1={hoveredPartnerNode.x}
                y1={hoveredPartnerNode.y}
                x2={peer.x}
                y2={peer.y}
                stroke="#F1B434"
                strokeWidth={2}
                strokeDasharray="6 4"
                opacity={0.85}
                style={{ transition: "opacity 0.3s ease" }}
              />
            );
          })}

        {ordered.map((n) => {
          // ── Compute opacity + scale for each mode ──────────────────────────
          let nodeOpacity = n.kind === "partner" ? 0.95 : 1;
          let nodeScale = 1;
          let highlight: "primary" | "secondary" | null = null;

          if (hoveredPartner !== null && hoveredPartnerNode) {
            // A partner is hovered — partner-level interaction takes over
            if (n.kind === "outline" || n.kind === "center") {
              // unchanged
            } else if (n.kind === "label") {
              nodeOpacity = 0.4;
            } else {
              // n.kind === "partner"
              if (HOVER_MODE === "wave") {
                const dx = n.x - hoveredPartnerNode.x;
                const dy = n.y - hoveredPartnerNode.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 1) {
                  nodeScale = 1.3; nodeOpacity = 1; highlight = "primary";  
                } else if (dist < HEX_SPACING * 1.5) {
                  nodeScale = 1.1; nodeOpacity = 1;
                } else if (dist < HEX_SPACING * 2.5) {
                  nodeOpacity = 0.8;
                } else {
                  nodeOpacity = 0.5;
                }
              } else if (HOVER_MODE === "relational") {
                const rf = hoveredPartnerNode.partner?.relational_feature;
                if (n.id === hoveredPartnerNode.id) {
                  nodeScale = 1.2; nodeOpacity = 1; highlight = "primary";
                } else if (rf && n.partner?.relational_feature === rf) {
                  nodeOpacity = 1; highlight = "secondary";
                } else {
                  nodeOpacity = 0.35;
                }
              } else if (HOVER_MODE === "constellation") {
                if (n.id === hoveredPartnerNode.id) {
                  nodeScale = 1.2; nodeOpacity = 1; highlight = "primary";
                } else if (relationalPeers.has(n.id)) {
                  nodeScale = 1.05; nodeOpacity = 1; highlight = "secondary";
                } else if (n.label === hoveredPartnerNode.label) {
                  nodeOpacity = 0.7;
                } else {
                  nodeOpacity = 0.2;
                }
              }
            }
          } else if (hoveredLabel !== null) {
            // A label hex is hovered — group highlight (unchanged behaviour)
            const isSameGroup =
              (n.kind === "label" || n.kind === "partner") && n.label === hoveredLabel;
            if (n.kind === "outline" || n.kind === "center") {
              nodeOpacity = 1;
            } else if (isSameGroup) {
              nodeOpacity = n.kind === "partner" ? 0.9 : 1;
            } else {
              nodeOpacity = 0.2;
            }
          }

          return (
            <g
              key={n.id}
              data-node="true"
              data-kind={n.kind}
              onMouseEnter={() => {
                if (n.kind === "partner") setHoveredPartner(n.id);
                else if (n.kind === "label") setHoveredLabel(n.label ?? null);
              }}
              onMouseLeave={() => {
                if (n.kind === "partner") setHoveredPartner(null);
                else if (n.kind === "label") setHoveredLabel(null);
              }}
              style={{
                opacity: nodeOpacity,
                transform: nodeScale !== 1 ? `scale(${nodeScale})` : undefined,
                transformBox: "fill-box",
                transformOrigin: "center",
                transition:
                  "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.45s ease",
                cursor:
                  n.kind === "label" || n.kind === "partner" ? "pointer" : "default",
              }}
            >
              <path
                d={hexPathFlat(n.x, n.y, n.r)}
                fill={fillFor(n, highlight)}
                stroke="white"
                strokeWidth={strokeWidthFor(n)}
              />

              {n.kind === "center" && n.name && (
                <>
                  {n.name.split("\n").map((line, idx) => (
                    <text
                      key={idx}
                      x={n.x}
                      y={n.y - 22 + idx * 16}
                      textAnchor="middle"
                      fontSize={20}
                      fill="black"
                      fontWeight={800}
                    // lineHeight={1.5}
                    >
                      {line}
                    </text>
                  ))}
                </>
              )}

              {n.kind === "label" && (
                <>
                  <text
                    x={n.x}
                    y={n.y - 4}
                    textAnchor="middle"
                    fontSize="42"
                    fill="black"
                    fontWeight={1000}
                    fontFamily="inherit"
                  >
                    {n.count}
                  </text>
                  {n.name?.split("\n").map((line, idx) => (
                    <text
                      key={idx}
                      x={n.x}
                      y={n.y + 20 + idx * 13}
                      textAnchor="middle"
                      fontSize="12"
                      fill="black"
                      fontWeight={1000}
                      
                    >
                      {line}
                    </text>
                  ))}
                </>
              )}

              {n.kind === "partner" && n.name && (
                <text
                  x={n.x}
                  y={n.y + 4}
                  textAnchor="middle"
                  fontSize={12}
                  fill="white"
                >
                  {n.name}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
