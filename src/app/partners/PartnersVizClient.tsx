"use client";

// src/app/partners/PartnersVizClient.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { HexNode } from "@/lib/partners/label";
type SimNode = HexNode & {
  x0: number;
  y0: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
};

function hexPathFlat(cx: number, cy: number, r: number) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i; // flat-top
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  return `M ${pts.map((p) => p.join(",")).join(" L ")} Z`;
}

function fillFor(n: HexNode) {
  if (n.kind === "center") return "white";
  if (n.kind === "label") return "#FFD89C";
  if (n.kind === "outline") return "none";
  return "black";
}

function strokeFor(n: HexNode) {
  if (n.kind === "outline") return "white";
  if (n.kind === "partner") return "white";
  return "rgba(0,0,0,0.25)";
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
    // 1) Build a lookup: group label -> label node position
    const labelPos = new Map<string, { x: number; y: number }>();
    for (const n of initialNodes) {
      if (n.kind === "label" && n.label) {
        labelPos.set(n.label, { x: n.x, y: n.y });
      }
    }

    return initialNodes.map((n) => {
      const fixed = n.kind !== "partner";

      // 2) For partners: start at their label's position (fold-out origin)
      const start =
        n.kind === "partner" && n.label ? labelPos.get(n.label) : undefined;

      const startX = start ? start.x : n.x;
      const startY = start ? start.y : n.y;

      return {
        ...n,
        // final target (where you *want* it to end up)
        x0: n.x,
        y0: n.y,

        // starting position (where it *begins* the animation)
        x: startX,
        y: startY,

        // fixed obstacles stay fixed
        fx: fixed ? n.x : undefined,
        fy: fixed ? n.y : undefined,
      };
    });
  }, [initialNodes]);

  useEffect(() => {
    let tl: any;

    (async () => {
      // import only on client, after mount
      const gsap = (await import("gsap")).default;

      const partners = simNodes.filter((n) => n.kind === "partner");
      setRenderNodes(
        simNodes.map((d) => ({ ...d, x: d.x ?? d.x0, y: d.y ?? d.y0 })),
      );

      tl = gsap.timeline({
        defaults: { ease: "power2.out" },
        onUpdate: () => {
          setRenderNodes(
            simNodes.map((d) => ({ ...d, x: d.x ?? d.x0, y: d.y ?? d.y0 })),
          );
        },
      });

      tl.to(partners, {
        duration: 5,
        x: (i: number, t: any) => t.x0,
        y: (i: number, t: any) => t.y0,
        stagger: { each: 0.006, from: "start" },
      });
    })();

    return () => {
      if (tl) tl.kill();
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
            style={{ cursor: n.kind === "label" ? "pointer" : "default" }}
          >
            <path
              d={hexPathFlat(n.x, n.y, n.r)}
              fill={fillFor(n)}
              opacity={nodeOpacity}
              stroke={strokeFor(n)}
              strokeWidth={n.kind === "outline" || n.kind === "partner" ? 2 : 0}
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
                  y={n.y - 6}
                  textAnchor="middle"
                  fontSize="18"
                  fill="black"
                  fontWeight={800}
                  opacity={nodeOpacity}
                >
                  {n.count}
                </text>
                {n.name?.split("\n").map((line, idx) => (
                  <text
                    key={idx}
                    x={n.x}
                    y={n.y + 14 + idx * 12}
                    textAnchor="middle"
                    fontSize="10"
                    fill="black"
                    fontWeight={800}
                    opacity={nodeOpacity}
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
                opacity={nodeOpacity}
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
