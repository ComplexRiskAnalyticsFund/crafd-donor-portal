"use client";

// src/app/partners/PartnersVizClient.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import type { HexNode } from "@/lib/partners/label";
type SimNode = HexNode & {
  x0: number;
  y0: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
};

const SQRT3 = Math.sqrt(3);
const HEX_SIZE = 75;

function hexPathFlat(cx: number, cy: number, r: number) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i; // flat-top
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  return `M ${pts.map((p) => p.join(",")).join(" L ")} Z`;
}

function fillFor(n: HexNode) {
  if (n.kind === "center") return "white";
  if (n.kind === "label") return "#C97A00";
  if (n.kind === "outline") return "none";
  return "#1C1C1C"; // partner
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
  const isPanning = useRef(false);
  const panStart = useRef({ clientX: 0, clientY: 0, panX: 0, panY: 0 });
  const MIN_SCALE = 0.4;
  const MAX_SCALE = 4;

  const simNodes = useMemo<SimNode[]>(() => {
    return initialNodes.map((n) => {
      const fixed = n.kind !== "partner";

      // Partners start from center (0,0) — not from label hex positions
      const startX = n.kind === "partner" ? 0 : n.x;
      const startY = n.kind === "partner" ? 0 : n.y;

      return {
        ...n,
        x0: n.x,
        y0: n.y,
        x: startX,
        y: startY,
        fx: fixed ? n.x : undefined,
        fy: fixed ? n.y : undefined,
      };
    });
  }, [initialNodes]);

  useEffect(() => {
    const partners = simNodes.filter((n) => n.kind === "partner");
    setRenderNodes(
      simNodes.map((d) => ({ ...d, x: d.x ?? d.x0, y: d.y ?? d.y0 })),
    );

    const tl = gsap.timeline({
      defaults: { ease: "power2.out" },
      onUpdate: () => {
        setRenderNodes(
          simNodes.map((d) => ({ ...d, x: d.x ?? d.x0, y: d.y ?? d.y0 })),
        );
      },
    });

    tl.to(partners, {
      duration: 3.33,
      x: (i: number, t: any) => t.x0,
      y: (i: number, t: any) => t.y0,
      stagger: { each: 0.004, from: "start" },
    });

    return () => {
      tl.kill();
    };
  }, []);

  // Wheel zoom (non-passive so we can preventDefault)
  useEffect(() => {
    const el = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursorSvgX = ((e.clientX - rect.left) / rect.width) * 1800 - 900;
      const cursorSvgY = ((e.clientY - rect.top) / rect.height) * 1000 - 500;
      const cx = (cursorSvgX - panRef.current.x) / scaleRef.current;
      const cy = (cursorSvgY - panRef.current.y) / scaleRef.current;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scaleRef.current * factor));
      setPan({ x: cursorSvgX - cx * newScale, y: cursorSvgY - cy * newScale });
      setScale(newScale);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    if ((e.target as Element).closest("[data-node]")) return;
    isPanning.current = true;
    panStart.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = "grabbing";
    setHoveredLabel(null);
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!isPanning.current) return;
    const { width } = svgRef.current!.getBoundingClientRect();
    const pixelToUnit = (1800 / width) / scaleRef.current;
    const dx = (e.clientX - panStart.current.clientX) * pixelToUnit;
    const dy = (e.clientY - panStart.current.clientY) * pixelToUnit;
    setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
  }

  function handlePointerUp() {
    if (!isPanning.current) return;
    isPanning.current = false;
    document.body.style.cursor = "";
  }

  function handleDoubleClick() {
    setPan({ x: 0, y: 0 });
    setScale(1);
  }

  const ordered = useMemo(() => {
    const z = (k: HexNode["kind"]) =>
      k === "outline" ? 0 : k === "partner" ? 1 : k === "label" ? 2 : 3;
    return [...renderNodes].sort((a, b) => z(a.kind) - z(b.kind));
  }, [renderNodes]);

  // Background hex grid covering the full viewport
  const bgHexes = useMemo(() => {
    const cells: { x: number; y: number; key: string }[] = [];
    for (let q = -14; q <= 14; q++) {
      for (let r = -14; r <= 14; r++) {
        const x = HEX_SIZE * 1.5 * q;
        const y = HEX_SIZE * SQRT3 * (r + q / 2);
        if (x > -1050 && x < 1050 && y > -650 && y < 650) {
          cells.push({ x, y, key: `bg-${q}-${r}` });
        }
      }
    }
    return cells;
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox="-900 -500 1800 1000"
      className="h-full w-full"
      style={{ cursor: "grab" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
        {/* Background hex grid */}
        {bgHexes.map(({ x, y, key }) => (
          <path
            key={key}
            d={hexPathFlat(x, y, HEX_SIZE)}
            fill="none"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth={1.5}
          />
        ))}

        {ordered.map((n) => {
          const isSameGroup =
            hoveredLabel !== null &&
            (n.kind === "label" || n.kind === "partner") &&
            n.label === hoveredLabel;

          const nodeOpacity =
            hoveredLabel === null
              ? n.kind === "partner"
                ? 0.95
                : 1
              : n.kind === "outline" || n.kind === "center"
                ? 1
                : isSameGroup
                  ? n.kind === "partner"
                    ? 0.95
                    : 1
                  : 0.2;

          return (
            <g
              key={n.id}
              data-node="true"
              onMouseEnter={
                n.kind === "label"
                  ? () => { if (!isPanning.current) setHoveredLabel(n.label ?? null); }
                  : undefined
              }
              onMouseLeave={
                n.kind === "label"
                  ? () => { if (!isPanning.current) setHoveredLabel(null); }
                  : undefined
              }
              style={{
                opacity: nodeOpacity,
                transition: "opacity 0.45s ease",
                cursor: n.kind === "label" ? "pointer" : "default",
              }}
            >
              <path
                d={hexPathFlat(n.x, n.y, n.r)}
                fill={fillFor(n)}
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
                      fontSize={16}
                      fill="black"
                      fontWeight={800}
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
                    y={n.y - 8}
                    textAnchor="middle"
                    fontSize="30"
                    fill="white"
                    fontWeight={900}
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
                      fontSize="9"
                      fill="white"
                      fontWeight={700}
                      letterSpacing="0.1em"
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
