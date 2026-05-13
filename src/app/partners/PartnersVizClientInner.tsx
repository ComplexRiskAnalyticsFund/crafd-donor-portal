"use client";

import { useEffect, useMemo, useState } from "react";
// Import GSAP normally to avoid dynamic import hangs in Turbopack
import gsap from "gsap";
import type { HexNode } from "@/lib/partners/label";

type SimNode = HexNode & { x0: number; y0: number };

export default function PartnersVizClientInner({
  initialNodes,
}: {
  initialNodes: HexNode[];
}) {
  const [renderNodes, setRenderNodes] = useState<SimNode[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const simNodesBase = useMemo<SimNode[]>(() => {
    const labelPos = new Map<string, { x: number; y: number }>();
    initialNodes.forEach(
      (n) =>
        n.kind === "label" &&
        n.label &&
        labelPos.set(n.label, { x: n.x, y: n.y }),
    );

    return initialNodes.map((n) => {
      const start =
        n.kind === "partner" && n.label ? labelPos.get(n.label) : undefined;
      return {
        ...n,
        x0: n.x,
        y0: n.y,
        x: start ? start.x : n.x,
        y: start ? start.y : n.y,
      };
    });
  }, [initialNodes]);

  useEffect(() => {
    if (!hasHydrated) return;

    // Use a fresh copy for the animation to avoid mutating the memo
    const workingNodes = simNodesBase.map((n) => ({ ...n }));
    setRenderNodes(workingNodes);

    const ctx = gsap.context(() => {
      const partners = workingNodes.filter((n) => n.kind === "partner");

      gsap.to(partners, {
        x: (i, t) => t.x0,
        y: (i, t) => t.y0,
        duration: 2.5,
        stagger: 0.005,
        ease: "power4.out",
        onUpdate: () => {
          // Trigger re-render by passing a new array reference
          setRenderNodes([...workingNodes.map((obj) => ({ ...obj }))]);
        },
      });
    });

    return () => ctx.revert();
  }, [hasHydrated, simNodesBase]);

  // Essential: Return null or a loader until hydrated to prevent mismatch
  if (!hasHydrated) return <div className="h-screen w-screen bg-[#FDB53C]" />;

  return (
    <div className="h-full w-full bg-[#FDB53C]">
      <svg viewBox="-900 -500 1800 1000" className="h-full w-full">
        {renderNodes.map((n) => (
          <g key={n.id}>
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={n.kind === "partner" ? "black" : "white"}
            />
            {/* Re-add your full hexPath logic here once this circles test works */}
          </g>
        ))}
      </svg>
    </div>
  );
}
