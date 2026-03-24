"use client";

import { useEffect, useMemo, useState } from "react";
// Import GSAP normally to avoid dynamic import hangs in Turbopack
import gsap from "gsap"; 
import type { HexNode } from "@/lib/partners/label";

type SimNode = HexNode & { x0: number; y0: number };

export default function PartnersVizClientInner({ initialNodes }: { initialNodes: HexNode[] }) {
  if (typeof window !== "undefined") {
    debugger; // This will force your browser to pause if JS is running
    console.log("CLIENT REACHED");
  }
  const [renderNodes, setRenderNodes] = useState<SimNode[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);

  // 1. THIS IS YOUR TRUTH TEST
  useEffect(() => {
    setHasHydrated(true);
    // If you don't see this popup, the Client JS isn't running at all
    window.alert("CLIENT JS IS RUNNING"); 
    console.log("CLIENT HYDRATED");
  }, []);

  const simNodesBase = useMemo<SimNode[]>(() => {
    const labelPos = new Map<string, { x: number; y: number }>();
    initialNodes.forEach(n => n.kind === "label" && n.label && labelPos.set(n.label, { x: n.x, y: n.y }));

    return initialNodes.map((n) => {
      const start = n.kind === "partner" && n.label ? labelPos.get(n.label) : undefined;
      return {
        ...n,
        x0: n.x, y0: n.y,
        x: start ? start.x : n.x,
        y: start ? start.y : n.y,
      };
    });
  }, [initialNodes]);

  useEffect(() => {
    if (!hasHydrated) return;

    // Use a fresh copy for the animation to avoid mutating the memo
    const workingNodes = simNodesBase.map(n => ({ ...n }));
    setRenderNodes(workingNodes);

    const ctx = gsap.context(() => {
      const partners = workingNodes.filter(n => n.kind === "partner");
      
      gsap.to(partners, {
        x: (i, t) => t.x0,
        y: (i, t) => t.y0,
        duration: 2.5,
        stagger: 0.005,
        ease: "power4.out",
        onUpdate: () => {
          // Trigger re-render by passing a new array reference
          setRenderNodes([...workingNodes.map(obj => ({ ...obj }))]);
        }
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
            <circle cx={n.x} cy={n.y} r={n.r} fill={n.kind === 'partner' ? 'black' : 'white'} />
            {/* Re-add your full hexPath logic here once this circles test works */}
          </g>
        ))}
      </svg>
    </div>
  );
}



// // src/app/partners/PartnersVizClient.tsx
// "use client";

// import { useEffect, useMemo, useRef, useState } from "react";
// // import { forceCollide, forceSimulation, forceX, forceY } from "d3-force";
// // import gsap from "gsap";
// import type { HexNode } from "@/lib/partners/label";
// console.log("PartnersVizClient rendered");
// type SimNode = HexNode & {
//   x0: number;
//   y0: number;
//   vx?: number;
//   vy?: number;
//   fx?: number;
//   fy?: number;
// };

// function hexPathFlat(cx: number, cy: number, r: number) {

//   const pts = Array.from({ length: 6 }, (_, i) => {
//     const a = (Math.PI / 3) * i; // flat-top
//     return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
//   });
//   return `M ${pts.map((p) => p.join(",")).join(" L ")} Z`;
// }

// function fillFor(n: HexNode) {
//   if (n.kind === "center") return "white";
//   if (n.kind === "label") return "#FFD89C";
//   if (n.kind === "outline") return "none";
//   return "black";
// }

// function strokeFor(n: HexNode) {
//   if (n.kind === "outline") return "white";
//   if (n.kind === "partner") return "white";
//   return "rgba(0,0,0,0.25)";
// }

// export default function PartnersVizClient({ initialNodes }: { initialNodes: HexNode[] }) {

//   const [renderNodes, setRenderNodes] = useState<HexNode[]>(initialNodes);

//   const simNodes = useMemo<SimNode[]>(() => {
   
//     // 1) Build a lookup: group label -> label node position
//     const labelPos = new Map<string, { x: number; y: number }>();
//     for (const n of initialNodes) {
//       if (n.kind === "label" && n.label) {
//         labelPos.set(n.label, { x: n.x, y: n.y });
//       }
//     }
  
//     return initialNodes.map((n) => {
//       const fixed = n.kind !== "partner";
  
//       // 2) For partners: start at their label's position (fold-out origin)
//       const start =
//         n.kind === "partner" && n.label ? labelPos.get(n.label) : undefined;
  
//       const startX = start ? start.x : n.x;
//       const startY = start ? start.y : n.y;
      
//       return {
//         ...n,
//         // final target (where you *want* it to end up)
//         x0: n.x,
//         y0: n.y,
  
//         // starting position (where it *begins* the animation)
//         x: startX,
//         y: startY,
  
//         // fixed obstacles stay fixed
//         fx: fixed ? n.x : undefined,
//         fy: fixed ? n.y : undefined,
//       };
//     });
//   }, [initialNodes]);


//   const rafRef = useRef<number | null>(null);

//   useEffect(() => {
//     let tl: any;

//     (async () => {
//       // import only on client, after mount
//       const gsap = (await import("gsap")).default;
  
//       document.title = "EFFECT RAN";
  
//       const partners = simNodes.filter((n) => n.kind === "partner");
//       setRenderNodes(simNodes.map((d) => ({ ...d, x: d.x ?? d.x0, y: d.y ?? d.y0 })));
  
//       tl = gsap.timeline({
//         defaults: { ease: "power2.out" },
//         onUpdate: () => {
//           setRenderNodes(simNodes.map((d) => ({ ...d, x: d.x ?? d.x0, y: d.y ?? d.y0 })));
//         },
//       });
  
//       tl.to(partners, {
//         duration: 5,
//         x: (i: number, t: any) => t.x0,
//         y: (i: number, t: any) => t.y0,
//         stagger: { each: 0.006, from: "start" },
//       });
//     })();
  
//     return () => {
//       if (tl) tl.kill();
//     };
//   }, []); 
//   const ordered = useMemo(() => {
//     const z = (k: HexNode["kind"]) =>
//       k === "outline" ? 0 : k === "partner" ? 1 : k === "label" ? 2 : 3;
//     return [...renderNodes].sort((a, b) => z(a.kind) - z(b.kind));
//   }, [renderNodes]);

//   return (
//     <svg viewBox="-900 -500 1800 1000" className="h-full w-full">
    
//       {ordered.map((n) => (
//         <g key={n.id}>
//           <path
//             d={hexPathFlat(n.x, n.y, n.r)}
//             fill={fillFor(n)}
//             opacity={n.kind === "partner" ? 0.95 : 1}
//             stroke={strokeFor(n)}
//             strokeWidth={n.kind === "outline" || n.kind === "partner" ? 2 : 0}
//           />

//           {n.kind === "center" && n.name && (
//             <>
//               {n.name.split("\n").map((line, idx) => (
//                 <text
//                   key={idx}
//                   x={n.x}
//                   y={n.y - 22 + idx * 16}
//                   textAnchor="middle"
//                   fontSize={16}
//                   fill="black"
//                   fontWeight={800}
//                 >
//                   {line}
//                 </text>
//               ))}
//             </>
//           )}

//           {n.kind === "label" && (
//             <>
//               <text x={n.x} y={n.y - 6} textAnchor="middle" fontSize="18" fill="black" fontWeight={800}>
//                 {n.count}
//               </text>
//               {n.name?.split("\n").map((line, idx) => (
//                 <text
//                   key={idx}
//                   x={n.x}
//                   y={n.y + 14 + idx * 12}
//                   textAnchor="middle"
//                   fontSize="10"
//                   fill="black"
//                   fontWeight={800}
//                 >
//                   {line}
//                 </text>
//               ))}
//             </>
//           )}

//           {n.kind === "partner" && n.name && (
//             <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="12" fill="white">
//               {n.name}
//             </text>
//           )}
//         </g>
//       ))}
//     </svg>
//   );
// }