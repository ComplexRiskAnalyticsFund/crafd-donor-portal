"use client";

// src/app/partners/PartnersVizClient.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import type { HexNode } from "@/lib/partners/label";
import type { CrafdProject } from "@/types";

const SQRT3 = Math.sqrt(3);
const HEX_SIZE = 75;
const GRID_LIMIT = 2400;
const MIN_SCALE = 0.4;
const MAX_SCALE = 2;

const PROJECT_LINE_DASHES = [
  "",
  "14 8",
  "3 8",
  "14 6 3 6",
  "24 10",
  "8 5",
  "3 5",
  "20 6 3 6 3 6",
];

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
    .replace(/[ /_]/g, "-")
    .replace(/[&(),]/g, "");
}

function hexPathFlat(cx: number, cy: number, r: number) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  return `M ${pts.map((p) => p.join(",")).join(" L ")} Z`;
}

function fillFor(n: HexNode, highlighted = false) {
  if (n.kind === "center") return "white";
  if (n.kind === "label") return "#FFD89C";
  if (n.kind === "outline") return "none";
  if (n.kind === "partner" && n.label === "donor") return "white";
  if (highlighted) return "#000000";
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

const _parseCache = new Map<string, Set<string>>();
const _emptySet: Set<string> = new Set();
function parseProjects(rp: string[] | string | undefined | null): Set<string> {
  if (!rp) return _emptySet;
  if (Array.isArray(rp)) {
    return rp.length === 0 ? _emptySet : new Set(rp);
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

function projectsOverlap(
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

function formatGrantSize(raw: string | number | null | undefined): string {
  if (raw == null || raw === "") return "—";
  const num =
    typeof raw === "number" ? raw : parseFloat(raw.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return String(raw);
  const prefix = typeof raw === "string" && raw.includes("$") ? "$" : "$";
  if (num >= 1_000_000) return `${prefix}${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${prefix}${(num / 1_000).toFixed(0)}K`;
  return `${prefix}${num}`;
}

export default function PartnersVizClient({
  initialNodes,
  asOf,
  projectsById,
}: {
  initialNodes: HexNode[];
  asOf: string;
  projectsById: Record<string, CrafdProject>;
}) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [hoveredPartner, setHoveredPartner] = useState<string | null>(null);
  const [renderNodes, setRenderNodes] = useState<HexNode[]>([]);
  const [lockedGroup, setLockedGroup] = useState<Set<string> | null>(null);
  const [lockedFeature, setLockedFeature] = useState<string | null>(null);
  const [lockedSourceNode, setLockedSourceNode] = useState<HexNode | null>(
    null,
  );
  const [ecosystemContextNode, setEcosystemContextNode] =
    useState<HexNode | null>(null);
  const [clickedNode, setClickedNode] = useState<HexNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLocked, setSearchLocked] = useState(false);
  const [openProjects, setOpenProjects] = useState<Set<string>>(
    () => new Set(),
  );
  const [isMobile, setIsMobile] = useState(false);
  const [tappedNodeId, setTappedNodeId] = useState<string | null>(null);
  const [sheetSnap, setSheetSnap] = useState<"half" | "full">("half");
  const sheetTouchStartY = useRef(0);
  const [partnerTooltip, setPartnerTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const panRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const animTlRef = useRef<gsap.core.Timeline | null>(null);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Touch pan/pinch refs
  const touchStartRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const pinchStartRef = useRef<{
    dist: number;
    scale: number;
    midX: number;
    midY: number;
  } | null>(null);
  const touchMovedRef = useRef(false);

  // Prevent white body background from showing as a strip on the right (100vw vs scrollbar width)
  useEffect(() => {
    const prev = {
      overflow: document.body.style.overflow,
      bg: document.body.style.background,
    };
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.background = "#FDB53C";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = prev.overflow;
      document.body.style.background = prev.bg;
    };
  }, []);

  // Detect mobile viewport
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Reset bottom sheet to half when panel changes
  useEffect(() => {
    setSheetSnap("half");
  }, [lockedFeature, clickedNode]);

  useEffect(() => {
    setRenderNodes(initialNodes);
  }, [initialNodes]);

  // Restore modal state from URL on mount (enables shareable links)
  useEffect(() => {
    const groupParam = searchParams.get("group");
    const partnerParam = searchParams.get("partner");
    if (groupParam) {
      const peers = new Set(
        initialNodes
          .filter(
            (n) =>
              n.kind === "partner" &&
              projectsOverlap(n.partner?.relational_project, groupParam),
          )
          .map((n) => n.id),
      );
      if (peers.size > 0) {
        setLockedGroup(peers);
        setLockedFeature(groupParam);
      }
    }
    if (partnerParam) {
      const node = initialNodes.find(
        (n) =>
          n.kind === "partner" &&
          (n.partner?.org_short_name ?? n.name) === partnerParam,
      );
      if (node) {
        if (node.label === "donor") {
          // Donor — open donor detail panel
          setClickedNode(node);
        } else {
          // Non-donor — open ecosystem view
          const rf = node.partner?.relational_project;
          if (rf && rf.length > 0) {
            const rfStr = rf.join(", ");
            const peers = new Set(
              initialNodes
                .filter(
                  (n2) =>
                    n2.kind === "partner" &&
                    n2.id !== node.id &&
                    projectsOverlap(n2.partner?.relational_project, rf),
                )
                .map((n2) => n2.id),
            );
            setLockedGroup(new Set([node.id, ...peers]));
            setLockedFeature(rfStr);
            setLockedSourceNode(node);
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pop-in animation — radial within group waves: Donor → UN/Project → Collab
  useEffect(() => {
    if (renderNodes.length === 0) return;
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const partnerGs = Array.from(
          svgEl.querySelectorAll<SVGGElement>('[data-kind="partner"]'),
        );
        if (partnerGs.length === 0) return;
        partnerGs.forEach((el) => {
          const cx = el.getAttribute("data-cx") ?? "0";
          const cy = el.getAttribute("data-cy") ?? "0";
          gsap.set(el, { opacity: 0, scale: 0, svgOrigin: `${cx} ${cy}` });
        });

        const GROUP_WAVE = 0.5; // seconds between group onsets
        const RADIAL_SPREAD = 0.6; // radial window within each group
        const GROUP_ORDER: Record<string, number> = {
          donor: 0,
          un: 1,
          project: 1,
          collaborating: 2,
        };
        const maxDist = partnerGs.reduce((m, el) => {
          const cx = parseFloat(el.getAttribute("data-cx") ?? "0");
          const cy = parseFloat(el.getAttribute("data-cy") ?? "0");
          return Math.max(m, Math.sqrt(cx * cx + cy * cy));
        }, 1);

        const tl = gsap.timeline({
          onComplete: () => {
            gsap.set(partnerGs, { clearProps: "transform,transformOrigin" });
          },
        });
        animTlRef.current = tl;

        partnerGs.forEach((el) => {
          const label = el.getAttribute("data-label") ?? "other";
          const cx = parseFloat(el.getAttribute("data-cx") ?? "0");
          const cy = parseFloat(el.getAttribute("data-cy") ?? "0");
          const dist = Math.sqrt(cx * cx + cy * cy);
          const t =
            (GROUP_ORDER[label] ?? 2) * GROUP_WAVE +
            (dist / maxDist) * RADIAL_SPREAD;
          tl.to(
            el,
            { opacity: 1, scale: 1, duration: 0.28, ease: "back.out(1.7)" },
            t,
          );
        });
      }),
    );
    return () => {
      cancelAnimationFrame(id);
      animTlRef.current?.kill();
      animTlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderNodes.length]);

  // Pan (two-finger) + zoom (pinch/Ctrl+scroll)
  // Attached to window so it works even when click-state-1 modal overlay is present.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      // Let the modal scroll naturally when the cursor is inside it
      if ((e.target as Element)?.closest?.("[data-modal]")) return;
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
        const newScale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, scaleRef.current * factor),
        );
        setPan(
          clampPan(
            cursorSvgX - cx * newScale,
            cursorSvgY - cy * newScale,
            newScale,
          ),
        );
        setScale(newScale);
      } else {
        const px2unit = 1800 / rect.width / scaleRef.current;
        setPan((p) =>
          clampPan(
            p.x - e.deltaX * px2unit,
            p.y - e.deltaY * px2unit,
            scaleRef.current,
          ),
        );
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  // Keyboard: arrows pan, +/- zoom, R reset, Escape dismisses modals outward
  useEffect(() => {
    const PAN_STEP = 50;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") {
        setLockedGroup(null);
        setLockedFeature(null);
        setLockedSourceNode(null);
        setEcosystemContextNode(null);
        setClickedNode(null);
        setTappedNodeId(null);
        setHoveredPartner(null);
        router.replace(pathname);
        return;
      }
      if (e.key === "ArrowLeft")
        setPan((p) => clampPan(p.x + PAN_STEP, p.y, scaleRef.current));
      else if (e.key === "ArrowRight")
        setPan((p) => clampPan(p.x - PAN_STEP, p.y, scaleRef.current));
      else if (e.key === "ArrowUp")
        setPan((p) => clampPan(p.x, p.y + PAN_STEP, scaleRef.current));
      else if (e.key === "ArrowDown")
        setPan((p) => clampPan(p.x, p.y - PAN_STEP, scaleRef.current));
      else if (e.key === "+" || e.key === "=")
        setScale((s) => Math.min(MAX_SCALE, s * 1.15));
      else if (e.key === "-") setScale((s) => Math.max(MIN_SCALE, s / 1.15));
      else if (e.key === "r" || e.key === "R") {
        setPan({ x: 0, y: 0 });
        setScale(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, pathname]);

  function handleDoubleClick() {
    setPan({ x: 0, y: 0 });
    setScale(1);
  }

  // Enter click state 1: lock the relational group of this partner
  function enterClickState1(n: HexNode) {
    const rf = n.partner?.relational_project;
    if (!rf || rf.length === 0) return;
    const rfStr = rf.join(", ");
    const peers = new Set(
      renderNodes
        .filter(
          (node) =>
            node.kind === "partner" &&
            node.id !== n.id &&
            projectsOverlap(node.partner?.relational_project, rf),
        )
        .map((node) => node.id),
    );
    setHoveredPartner(null);
    setHoveredLabel(null);
    setClickedNode(null);
    setTappedNodeId(null);
    // Track the origin partner when navigating within an existing ecosystem.
    // If navigating back to the context partner itself, clear the pretitle.
    const isReturningToContext =
      lockedGroup !== null && n.id === ecosystemContextNode?.id;
    setEcosystemContextNode(
      isReturningToContext
        ? null
        : lockedGroup !== null
          ? (lockedSourceNode ?? null)
          : null,
    );
    setLockedGroup(new Set([n.id, ...peers]));
    setLockedFeature(rfStr);
    setLockedSourceNode(n);
    setOpenProjects(new Set(rf));
    router.replace(`${pathname}?group=${encodeURIComponent(rfStr)}`);
  }

  const bgHexes = useMemo(() => {
    const FADE_START = 200;
    const FADE_END = 2400;
    const cells: { d: string; key: string; opacity: number }[] = [];
    for (let q = -28; q <= 28; q++) {
      for (let r = -28; r <= 28; r++) {
        const x = HEX_SIZE * 1.5 * q;
        const y = HEX_SIZE * SQRT3 * (r + q / 2);
        const dist = Math.sqrt(x * x + y * y);
        if (dist > FADE_END) continue;
        const t = Math.max(0, (dist - FADE_START) / (FADE_END - FADE_START));
        cells.push({
          d: hexPathFlat(x, y, HEX_SIZE),
          key: `bg-${q}-${r}`,
          opacity: 0.9 * (1 - t),
        });
      }
    }
    return cells;
  }, []);

  const hoveredPartnerNode = useMemo(
    () =>
      hoveredPartner
        ? (renderNodes.find((n) => n.id === hoveredPartner) ?? null)
        : null,
    [hoveredPartner, renderNodes],
  );

  const relationalPeers = useMemo(() => {
    const rf = hoveredPartnerNode?.partner?.relational_project;
    if (!rf) return new Set<string>();
    return new Set(
      renderNodes
        .filter(
          (n) =>
            n.kind === "partner" &&
            n.id !== hoveredPartnerNode!.id &&
            projectsOverlap(n.partner?.relational_project, rf),
        )
        .map((n) => n.id),
    );
  }, [hoveredPartnerNode, renderNodes]);

  const ordered = useMemo(() => {
    // Compute hub IDs inline so hubs always render on top in CS1
    const hubIds = new Set<string>();
    if (lockedGroup && lockedFeature) {
      const _lockedNodes = renderNodes.filter(
        (n) => n.kind === "partner" && lockedGroup.has(n.id),
      );
      for (const proj of parseProjects(lockedFeature)) {
        const projNodes = _lockedNodes.filter((n) =>
          parseProjects(n.partner?.relational_project).has(proj),
        );
        const hub =
          projNodes.find((n) =>
            n.partner?.crafd_connection?.some(
              (c) =>
                c.toLowerCase().includes("project lead") ||
                c.toLowerCase().includes("lead project"),
            ),
          ) ??
          (lockedSourceNode &&
          projNodes.some((n) => n.id === lockedSourceNode.id)
            ? lockedSourceNode
            : null) ??
          projNodes[0];
        if (hub) hubIds.add(hub.id);
      }
    }

    function priority(n: HexNode): number {
      if (lockedGroup !== null && n.kind === "partner") {
        if (hubIds.has(n.id)) return 200;
        if (lockedGroup.has(n.id)) return 100;
      }
      if (hoveredPartnerNode && n.kind === "partner") {
        if (n.id === hoveredPartnerNode.id) return 100;
        if (relationalPeers.has(n.id)) return 50;
      }
      const base: Record<HexNode["kind"], number> = {
        outline: 0,
        partner: 1,
        label: 2,
        center: 3,
      };
      return base[n.kind];
    }
    return [...renderNodes].sort((a, b) => priority(a) - priority(b));
  }, [
    renderNodes,
    hoveredPartnerNode,
    relationalPeers,
    lockedGroup,
    lockedFeature,
    lockedSourceNode,
  ]);

  const lockedNodes = useMemo(
    () =>
      lockedGroup
        ? renderNodes.filter(
            (n) => n.kind === "partner" && lockedGroup.has(n.id),
          )
        : [],
    [lockedGroup, renderNodes],
  );

  // Per-project hub-spoke line data for click state 1
  const projectLineData = useMemo(() => {
    if (!lockedGroup || !lockedNodes.length || !lockedFeature) return [];
    const projects = [...parseProjects(lockedFeature)];
    const isSingle = projects.length === 1;
    return projects.flatMap((proj, idx) => {
      const projNodes = lockedNodes.filter((n) =>
        parseProjects(n.partner?.relational_project).has(proj),
      );
      if (projNodes.length < 2) return [];
      // Hub: project lead in this group, then the clicked node if it's here, then first node
      const hub =
        projNodes.find((n) =>
          n.partner?.crafd_connection?.some(
            (c) =>
              c.toLowerCase().includes("project lead") ||
              c.toLowerCase().includes("lead project"),
          ),
        ) ??
        (lockedSourceNode && projNodes.some((n) => n.id === lockedSourceNode.id)
          ? lockedSourceNode
          : null) ??
        projNodes[0];
      const dasharray = isSingle
        ? ""
        : PROJECT_LINE_DASHES[idx % PROJECT_LINE_DASHES.length];
      return projNodes
        .filter((n) => n.id !== hub.id)
        .map((spoke) => ({
          hub,
          spoke,
          dasharray,
          isSourceLine:
            spoke.id === lockedSourceNode?.id ||
            hub.id === lockedSourceNode?.id,
        }));
    });
  }, [lockedGroup, lockedNodes, lockedFeature, lockedSourceNode]);

  const hubDashes = useMemo(() => {
    const map = new Map<string, string>();
    for (const { hub, dasharray } of projectLineData) {
      if (!map.has(hub.id)) map.set(hub.id, dasharray);
    }
    return map;
  }, [projectLineData]);

  return (
    <div className="fixed inset-0" style={{ background: "#FDB53C" }}>
      <svg
        ref={svgRef}
        viewBox="-900 -500 1800 1000"
        className="h-full w-full"
        style={{ cursor: "default", touchAction: "none" }}
        onDoubleClick={handleDoubleClick}
        onClick={() => {
          if (isMobile && !touchMovedRef.current) {
            setTappedNodeId(null);
            setHoveredPartner(null);
          }
        }}
        onTouchStart={(e) => {
          if ((e.target as Element)?.closest?.("[data-modal]")) return;
          touchMovedRef.current = false;
          if (e.touches.length === 1) {
            touchStartRef.current = {
              x: e.touches[0].clientX,
              y: e.touches[0].clientY,
              panX: panRef.current.x,
              panY: panRef.current.y,
            };
            pinchStartRef.current = null;
          } else if (e.touches.length === 2) {
            const dx = e.touches[1].clientX - e.touches[0].clientX;
            const dy = e.touches[1].clientY - e.touches[0].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            pinchStartRef.current = {
              dist,
              scale: scaleRef.current,
              midX,
              midY,
            };
            touchStartRef.current = null;
          }
        }}
        onTouchMove={(e) => {
          if ((e.target as Element)?.closest?.("[data-modal]")) return;
          e.preventDefault();
          const el = svgRef.current;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          if (e.touches.length === 1 && touchStartRef.current) {
            const dx = e.touches[0].clientX - touchStartRef.current.x;
            const dy = e.touches[0].clientY - touchStartRef.current.y;
            if (Math.abs(dx) > 4 || Math.abs(dy) > 4)
              touchMovedRef.current = true;
            const px2unit = 1800 / rect.width;
            setPan(
              clampPan(
                touchStartRef.current.panX + dx * px2unit,
                touchStartRef.current.panY + dy * px2unit,
                scaleRef.current,
              ),
            );
          } else if (e.touches.length === 2 && pinchStartRef.current) {
            touchMovedRef.current = true;
            const dx = e.touches[1].clientX - e.touches[0].clientX;
            const dy = e.touches[1].clientY - e.touches[0].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const newScale = Math.min(
              MAX_SCALE,
              Math.max(
                MIN_SCALE,
                pinchStartRef.current.scale *
                  (dist / pinchStartRef.current.dist),
              ),
            );
            const midSvgX =
              ((pinchStartRef.current.midX - rect.left) / rect.width) * 1800 -
              900;
            const midSvgY =
              ((pinchStartRef.current.midY - rect.top) / rect.height) * 1000 -
              500;
            const cx = (midSvgX - panRef.current.x) / scaleRef.current;
            const cy = (midSvgY - panRef.current.y) / scaleRef.current;
            setPan(
              clampPan(
                midSvgX - cx * newScale,
                midSvgY - cy * newScale,
                newScale,
              ),
            );
            setScale(newScale);
          }
        }}
        onTouchEnd={() => {
          touchStartRef.current = null;
          pinchStartRef.current = null;
        }}
      >
        <defs>
          <filter id="grayscale">
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <filter id="to-white" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"
            />
          </filter>
        </defs>
        {/*
          SVG backdrop rect — spans the full viewBox, drawn BEFORE the pan/scale group
          (so hexes above it in z-order still receive clicks first).
          Handles click-to-exit click state 1 without an HTML overlay div.
        */}
        {lockedGroup !== null && (
          <rect
            x="-900"
            y="-500"
            width="1800"
            height="1000"
            fill="transparent"
            style={{ cursor: "default" }}
            onClick={() => {
              setLockedGroup(null);
              setLockedFeature(null);
              setLockedSourceNode(null);
              setEcosystemContextNode(null);
              setClickedNode(null);
              setTappedNodeId(null);
              setHoveredPartner(null);
              router.replace(pathname);
            }}
          />
        )}

        <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
          {/* Background hex grid */}
          {bgHexes.map(({ d, key, opacity }) => (
            <path
              key={key}
              suppressHydrationWarning
              d={d}
              fill="none"
              stroke="white"
              strokeWidth={1.5}
              strokeOpacity={opacity * (lockedGroup !== null ? 0.18 : 1)}
            />
          ))}

          {/* Connecting lines — per-project hub-spoke, drawn under hexes */}
          {projectLineData.map(({ hub, spoke, dasharray, isSourceLine }, i) => {
            const dx = spoke.x - hub.x;
            const dy = spoke.y - hub.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) return null;
            const ux = dx / dist,
              uy = dy / dist;
            const x1 = hub.x + ux * hub.r,
              y1 = hub.y + uy * hub.r;
            const x2 = spoke.x - ux * spoke.r,
              y2 = spoke.y - uy * spoke.r;
            return (
              <g key={`conn-${i}-${hub.id}-${spoke.id}`}>
                {isSourceLine && (
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="white"
                    strokeWidth={18}
                    strokeOpacity={0.18}
                    strokeLinecap="round"
                  />
                )}
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="white"
                  strokeWidth={isSourceLine ? 7 : 2.5}
                  strokeOpacity={isSourceLine ? 0.95 : 0.7}
                  strokeLinecap="round"
                  strokeDasharray={dasharray || undefined}
                />
              </g>
            );
          })}

          {ordered.map((n) => {
            let nodeOpacity = n.kind === "partner" ? 0.95 : 1;
            let nodeScale = 1;
            let highlight = false;

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
                const rf = hoveredPartnerNode.partner?.relational_project;
                if (n.id === hoveredPartnerNode.id) {
                  nodeScale = 1.5;
                  nodeOpacity = 1;
                  highlight = true;
                } else if (
                  rf &&
                  projectsOverlap(n.partner?.relational_project, rf)
                ) {
                  nodeOpacity = 1;
                  highlight = true;
                } else {
                  nodeOpacity = 0.35;
                }
              }
            } else if (searchQuery.trim()) {
              if (n.kind === "partner") {
                const q = searchQuery.toLowerCase();
                const hit =
                  (n.name ?? "").toLowerCase().includes(q) ||
                  (n.partner?.org_full_name ?? "").toLowerCase().includes(q);
                nodeOpacity = hit ? 1 : 0.12;
              }
            } else if (hoveredLabel !== null) {
              const isSameGroup =
                (n.kind === "label" || n.kind === "partner") &&
                n.label === hoveredLabel;
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
                    if (lockedGroup || isMobile) return;
                    if (n.kind === "label") setHoveredLabel(n.label ?? null);
                  }}
                  onMouseLeave={() => {
                    if (lockedGroup || isMobile) return;
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
                      href="/images/crafd-logo-full-black.svg"
                      x={n.x - n.r * 0.54}
                      y={n.y - n.r * 0.37}
                      width={n.r * 1.08}
                      height={n.r * 0.735}
                      preserveAspectRatio="xMidYMid meet"
                    />
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
                        {n.label === "collaborating" ? "+" : ""}
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
                data-label={n.label}
                data-cx={n.x}
                data-cy={n.y}
                onMouseEnter={() => {
                  if (lockedGroup || isMobile) return;
                  setHoveredPartner(n.id);
                }}
                onMouseLeave={() => {
                  if (lockedGroup || isMobile) return;
                  setHoveredPartner(null);
                }}
                onClick={(e) => {
                  e.stopPropagation(); // prevent SVG backdrop rect from firing

                  // Mobile: first tap = hover state, second tap = open modal
                  if (isMobile && tappedNodeId !== n.id) {
                    setTappedNodeId(n.id);
                    setHoveredPartner(n.id);
                    return;
                  }
                  if (isMobile) {
                    setTappedNodeId(null);
                    setHoveredPartner(null);
                  }

                  if (n.label === "donor") {
                    // Donors have no relational_project — open donor detail panel
                    setClickedNode(n);
                    const slug = encodeURIComponent(
                      n.partner?.org_short_name ?? n.name ?? "",
                    );
                    router.replace(`${pathname}?partner=${slug}`);
                    return;
                  }
                  if (lockedGroup !== null) {
                    if (isLocked) {
                      enterClickState1(n);
                    }
                  } else {
                    enterClickState1(n);
                  }
                }}
                style={{
                  opacity: nodeOpacity,
                  transition: "opacity 0.45s ease",
                  cursor:
                    lockedGroup !== null
                      ? isLocked
                        ? "pointer"
                        : "default"
                      : "pointer",
                }}
              >
                {/* SVG translate: positions origin at hex center */}
                <g transform={`translate(${n.x},${n.y})`}>
                  {/* Hub glow — static inner halo + 3 expanding burst rings */}
                  {hubDashes.has(n.id) && (
                    <>
                      <path
                        d={hexPathFlat(0, 0, n.r * 1.22)}
                        fill="rgba(255,255,255,0.12)"
                        stroke="white"
                        strokeWidth={4}
                        strokeDasharray={hubDashes.get(n.id) || undefined}
                        strokeLinecap="round"
                        style={{ fillOpacity: 0.28, strokeOpacity: 0.7 }}
                      />
                      {([0, 0.8, 1.6] as const).map((delay) => (
                        <path
                          key={delay}
                          d={hexPathFlat(0, 0, n.r * 1.05)}
                          fill="rgba(255,255,255,0.10)"
                          stroke="white"
                          strokeWidth={2.5}
                          strokeDasharray={hubDashes.get(n.id) || undefined}
                          strokeLinecap="round"
                          className="hub-ring"
                          style={{
                            animationDelay: `${delay}s`,
                            transformOrigin: "0 0",
                          }}
                        />
                      ))}
                    </>
                  )}
                  {/* CSS scale: origin (0,0) = hex center → always anchored correctly */}
                  <g
                    style={{
                      transformOrigin: "0 0",
                      transform:
                        nodeScale !== 1 ? `scale(${nodeScale})` : undefined,
                      transition:
                        "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
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
                        <image
                          href={`/logos/countries/${slug}.svg`}
                          x={-boxW / 2}
                          y={-boxH / 2}
                          width={boxW}
                          height={boxH}
                          preserveAspectRatio="xMidYMid meet"
                        />
                        {hoveredPartner === n.id && n.name && (
                          <text
                            x={0}
                            y={boxH / 2 + 14}
                            textAnchor="middle"
                            fontSize={9}
                            fill="#1C1C1C"
                            fontWeight={700}
                          >
                            {n.name}
                          </text>
                        )}
                      </>
                    ) : (n.partner?.thumb_logo_path ??
                      n.partner?.white_logo_path ??
                      n.partner?.color_logo_path) ? (
                      <>
                        <image
                          href={
                            n.partner!.thumb_logo_path ??
                            n.partner!.white_logo_path ??
                            n.partner!.color_logo_path ??
                            ""
                          }
                          x={-boxW / 2}
                          y={-boxH / 2}
                          width={boxW}
                          height={boxH}
                          preserveAspectRatio="xMidYMid meet"
                          imageRendering="optimizeQuality"
                          style={
                            !n.partner!.thumb_logo_path &&
                            !n.partner!.white_logo_path
                              ? { filter: "grayscale(100%) brightness(1.1)" }
                              : undefined
                          }
                        />
                        {hoveredPartner === n.id && n.name && (
                          <text
                            x={0}
                            y={boxH / 2 + 14}
                            textAnchor="middle"
                            fontSize={9}
                            fill="white"
                            fontWeight={700}
                          >
                            {n.name}
                          </text>
                        )}
                      </>
                    ) : n.name ? (
                      (() => {
                        const words = n.name.split(" ");
                        const lines: string[] = [];
                        let cur = "";
                        for (const w of words) {
                          if (cur && (cur + " " + w).length > 11) {
                            lines.push(cur);
                            cur = w;
                          } else cur = cur ? cur + " " + w : w;
                        }
                        if (cur) lines.push(cur);
                        const lineH = 13;
                        const totalSpan = (lines.length - 1) * lineH;
                        return (
                          <>
                            {lines.map((line, i) => (
                              <text
                                key={i}
                                x={0}
                                y={-totalSpan / 2 + i * lineH + 4}
                                textAnchor="middle"
                                fontSize={11}
                                fill="white"
                                fontWeight={700}
                                letterSpacing="0.02em"
                              >
                                {line}
                              </text>
                            ))}
                          </>
                        );
                      })()
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
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            pointerEvents: "none",
          }}
        >
          {/* Mobile backdrop */}
          {isMobile && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.55)",
                pointerEvents: "all",
              }}
              onClick={() => {
                setLockedGroup(null);
                setLockedFeature(null);
                setLockedSourceNode(null);
                setEcosystemContextNode(null);
                setClickedNode(null);
                setTappedNodeId(null);
                setHoveredPartner(null);
                router.replace(pathname);
              }}
            />
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={`cs1-panel-${lockedSourceNode?.id ?? lockedFeature}`}
              initial={isMobile ? { y: "100%" } : { x: "-100%" }}
              animate={isMobile ? { y: 0 } : { x: 0 }}
              exit={isMobile ? { y: "100%" } : { x: "-100%" }}
              transition={{ type: "tween", ease: "easeInOut", duration: 0.18 }}
              style={
                isMobile
                  ? {
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: sheetSnap === "full" ? "100dvh" : "50dvh",
                      transition: "height 0.3s ease",
                      pointerEvents: "all",
                      background: "rgba(8,8,8,0.96)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      borderTop: "1px solid rgba(255,255,255,0.12)",
                      borderTopLeftRadius: sheetSnap === "full" ? 0 : 16,
                      borderTopRightRadius: sheetSnap === "full" ? 0 : 16,
                      color: "white",
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                    }
                  : {
                      width: "33.33vw",
                      minWidth: 360,
                      maxWidth: 700,
                      pointerEvents: "all",
                      background: "rgba(8,8,8,0.93)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      borderRight: "1px solid rgba(255,255,255,0.08)",
                      color: "white",
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                    }
              }
              data-modal="true"
            >
              {(() => {
                const projects = [...parseProjects(lockedFeature)];
                const partnerName =
                  lockedSourceNode?.partner?.org_short_name?.trim() ??
                  lockedSourceNode?.name ??
                  "Partner";
                const contextName =
                  ecosystemContextNode?.partner?.org_short_name?.trim() ??
                  ecosystemContextNode?.name ??
                  null;
                return (
                  <>
                    {/* Mobile drag handle */}
                    {isMobile && (
                      <div
                        onTouchStart={(e) => {
                          sheetTouchStartY.current = e.touches[0].clientY;
                        }}
                        onTouchEnd={(e) => {
                          const dy =
                            e.changedTouches[0].clientY -
                            sheetTouchStartY.current;
                          if (dy < -30) setSheetSnap("full");
                          else if (dy > 30) {
                            if (sheetSnap === "full") setSheetSnap("half");
                            else {
                              setLockedGroup(null);
                              setLockedFeature(null);
                              setLockedSourceNode(null);
                              setEcosystemContextNode(null);
                              setTappedNodeId(null);
                              setHoveredPartner(null);
                              router.replace(pathname);
                            }
                          }
                        }}
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          padding: "12px 0 4px",
                          cursor: "grab",
                          touchAction: "none",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 4,
                            borderRadius: 2,
                            background: "rgba(255,255,255,0.3)",
                          }}
                        />
                      </div>
                    )}
                    {/* Sticky header — close button, ecosystem label, project nav, separator */}
                    <div
                      style={{
                        padding: isMobile
                          ? "1rem 1.5rem 1rem"
                          : "2.5rem 2.5rem 1.25rem",
                        flexShrink: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                      }}
                    >
                      {/* Header row — title + close button */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: "1rem",
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: "0.85rem",
                          }}
                        >
                          {/* Logo */}
                          {(() => {
                            const p = lockedSourceNode?.partner;
                            const src =
                              p?.white_logo_path ?? p?.color_logo_path;
                            const needsFilter =
                              !p?.white_logo_path && !!p?.color_logo_path;
                            return src ? (
                              <img
                                src={src}
                                alt={partnerName}
                                style={{
                                  height: isMobile ? 32 : 44,
                                  width: "auto",
                                  maxWidth: 100,
                                  objectFit: "contain",
                                  flexShrink: 0,
                                  filter: needsFilter
                                    ? "grayscale(100%) brightness(1.1)"
                                    : undefined,
                                }}
                              />
                            ) : null;
                          })()}
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.25rem",
                            }}
                          >
                            <h1
                              style={{
                                fontSize: isMobile ? "1.2rem" : "1.6rem",
                                letterSpacing: "0.03em",
                                textTransform: "uppercase",
                                color: "#F1B434",
                                fontWeight: 400,
                                margin: 0,
                                lineHeight: 1.15,
                              }}
                            >
                              Ecosystem of{" "}
                              <span style={{ fontWeight: 800 }}>
                                {partnerName}
                              </span>
                            </h1>
                            {lockedSourceNode?.partner?.org_type && (
                              <p
                                style={{
                                  fontSize: "0.62rem",
                                  fontWeight: 700,
                                  letterSpacing: "0.12em",
                                  textTransform: "uppercase",
                                  color: "rgba(255,255,255,0.4)",
                                  margin: 0,
                                }}
                              >
                                {lockedSourceNode.partner.org_type}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setLockedGroup(null);
                            setLockedFeature(null);
                            setLockedSourceNode(null);
                            setEcosystemContextNode(null);
                            setClickedNode(null);
                            setTappedNodeId(null);
                            setHoveredPartner(null);
                            router.replace(pathname);
                          }}
                          style={{
                            flexShrink: 0,
                            background: "none",
                            border: "1px solid rgba(255,255,255,0.2)",
                            borderRadius: "50%",
                            color: "white",
                            width: isMobile ? 40 : 32,
                            height: isMobile ? 40 : 32,
                            fontSize: isMobile ? "1.4rem" : "1.1rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>

                    {/* Scrollable content */}
                    <div
                      style={{
                        flex: 1,
                        overflowY: "auto",
                        padding: isMobile
                          ? "1rem 1.5rem 1.5rem"
                          : "1.5rem 2.5rem 2.5rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "1.25rem",
                      }}
                      data-modal="true"
                    >
                      {projects.map((proj, idx) => {
                        const pd = projectsById[proj];
                        const projPartners = lockedNodes
                          .filter((n) =>
                            parseProjects(n.partner?.relational_project).has(
                              proj,
                            ),
                          )
                          .sort((a, b) =>
                            (
                              a.partner?.org_short_name ??
                              a.name ??
                              ""
                            ).localeCompare(
                              b.partner?.org_short_name ?? b.name ?? "",
                            ),
                          );
                        const isProjOpen = !openProjects.has(proj);
                        const toggleProj = () =>
                          setOpenProjects((prev) => {
                            const next = new Set(prev);
                            if (next.has(proj)) next.delete(proj);
                            else next.add(proj);
                            return next;
                          });
                        return (
                          <div
                            key={proj}
                            id={`cs1-proj-${idx}`}
                            style={{ display: "flex", flexDirection: "column" }}
                          >
                            <div
                              style={{
                                borderLeft: "3px solid #F1B434",
                                paddingLeft: "0.6rem",
                              }}
                            >
                              <button
                                onClick={toggleProj}
                                style={{
                                  background: "none",
                                  border: "none",
                                  padding: 0,
                                  cursor: "pointer",
                                  color: "white",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  gap: "0.75rem",
                                  paddingBottom: "0.45rem",
                                  width: "100%",
                                  textAlign: "left",
                                }}
                              >
                                <h3
                                  style={{
                                    fontSize: "1.05rem",
                                    fontWeight: 800,
                                    lineHeight: 1.3,
                                    margin: 0,
                                    flex: 1,
                                  }}
                                >
                                  {(() => {
                                    const pId =
                                      lockedSourceNode?.partner?.airtable_id;
                                    const isLead =
                                      pId && pd?.linked_lead_org?.includes(pId);
                                    const isSupporting =
                                      pId &&
                                      pd?.linked_supporting_org?.includes(pId);
                                    const role = isLead
                                      ? "Project Lead"
                                      : isSupporting
                                        ? "Collaborating Partner"
                                        : null;
                                    return role ? (
                                      <span
                                        style={{
                                          color: "#F1B434",
                                          fontWeight: 700,
                                        }}
                                      >
                                        {role}
                                        <span
                                          style={{
                                            opacity: 0.4,
                                            margin: "0 0.4rem",
                                          }}
                                        >
                                          |
                                        </span>
                                      </span>
                                    ) : null;
                                  })()}
                                  {pd?.full_title ?? pd?.project_label ?? proj}
                                </h3>
                                <motion.svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  animate={{ rotate: isProjOpen ? 180 : 0 }}
                                  transition={{
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 28,
                                  }}
                                  style={{
                                    marginTop: 3,
                                    opacity: 0.6,
                                    flexShrink: 0,
                                  }}
                                >
                                  <path
                                    d="M4 6l4 4 4-4"
                                    stroke="white"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </motion.svg>
                              </button>
                              {(pd?.grant_size ||
                                pd?.duration_months ||
                                pd?.project_coverage) && (
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "0.5rem",
                                    flexWrap: "wrap",
                                    paddingBottom: "0.5rem",
                                  }}
                                >
                                  {pd?.grant_size && (
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.3rem",
                                        background: "rgba(255,255,255,0.08)",
                                        border:
                                          "1px solid rgba(255,255,255,0.18)",
                                        borderRadius: 6,
                                        padding: "0.2rem 0.55rem",
                                        fontSize: "0.9rem",
                                        fontWeight: 700,
                                        color: "rgba(255,255,255,0.85)",
                                        letterSpacing: "0.04em",
                                      }}
                                    >
                                      {formatGrantSize(pd.grant_size)}
                                    </span>
                                  )}
                                  {pd?.duration_months && (
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.3rem",
                                        background: "rgba(255,255,255,0.06)",
                                        border:
                                          "1px solid rgba(255,255,255,0.15)",
                                        borderRadius: 6,
                                        padding: "0.2rem 0.55rem",
                                        fontSize: "0.9rem",
                                        fontWeight: 700,
                                        color: "rgba(255,255,255,0.7)",
                                        letterSpacing: "0.04em",
                                      }}
                                    >
                                      {pd.duration_months} months
                                    </span>
                                  )}
                                  {pd?.project_coverage && (
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.3rem",
                                        background: "rgba(255,255,255,0.06)",
                                        border:
                                          "1px solid rgba(255,255,255,0.15)",
                                        borderRadius: 6,
                                        padding: "0.2rem 0.55rem",
                                        fontSize: "0.9rem",
                                        fontWeight: 700,
                                        color: "rgba(255,255,255,0.7)",
                                        letterSpacing: "0.04em",
                                      }}
                                    >
                                      {pd.project_coverage}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <AnimatePresence initial={false}>
                              {isProjOpen && (
                                <motion.div
                                  key="body"
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{
                                    height: {
                                      type: "spring",
                                      stiffness: 300,
                                      damping: 30,
                                    },
                                    opacity: { duration: 0.18 },
                                  }}
                                  style={{ overflow: "hidden" }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "0.6rem",
                                      paddingTop: "0.6rem",
                                      paddingBottom: "0.25rem",
                                      paddingLeft: "calc(3px + 0.6rem)",
                                    }}
                                  >
                                    {pd?.project_blurb && (
                                      <p
                                        style={{
                                          fontSize: "0.88rem",
                                          lineHeight: 1.75,
                                          opacity: 0.78,
                                          margin: 0,
                                        }}
                                      >
                                        {pd.project_blurb}
                                      </p>
                                    )}

                                    {/* Project page link */}
                                    {pd?.project_url && (
                                      <a
                                        href={pd.project_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          background: "#F1B434",
                                          color: "#000",
                                          fontWeight: 800,
                                          fontSize: "0.72rem",
                                          letterSpacing: "0.08em",
                                          textTransform: "uppercase",
                                          border: "none",
                                          borderRadius: 6,
                                          padding: "0.55rem 1rem",
                                          cursor: "pointer",
                                          textDecoration: "none",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "0.5rem",
                                          alignSelf: "flex-start",
                                          transition: "all 0.2s ease",
                                        }}
                                        onMouseEnter={(e) => {
                                          (
                                            e.currentTarget as HTMLAnchorElement
                                          ).style.transform =
                                            "translateY(-2px)";
                                          (
                                            e.currentTarget as HTMLAnchorElement
                                          ).style.boxShadow =
                                            "0 4px 8px rgba(0,0,0,0.2)";
                                        }}
                                        onMouseLeave={(e) => {
                                          (
                                            e.currentTarget as HTMLAnchorElement
                                          ).style.transform = "translateY(0)";
                                          (
                                            e.currentTarget as HTMLAnchorElement
                                          ).style.boxShadow = "none";
                                        }}
                                      >
                                        <svg
                                          width="13"
                                          height="13"
                                          viewBox="0 0 16 16"
                                          fill="none"
                                          style={{ flexShrink: 0 }}
                                        >
                                          <path
                                            d="M2 8h12M10 6l2 2-2 2"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                        Visit project page
                                      </a>
                                    )}

                                    {projPartners.length > 0 &&
                                      (() => {
                                        const isLeadInProj = (
                                          pn: (typeof projPartners)[0],
                                        ) =>
                                          !!(
                                            pn.partner?.airtable_id &&
                                            pd?.linked_lead_org?.includes(
                                              pn.partner.airtable_id,
                                            )
                                          );
                                        const leadPartners =
                                          projPartners.filter(isLeadInProj);
                                        const otherPartners =
                                          projPartners.filter(
                                            (pn) => !isLeadInProj(pn),
                                          );
                                        const renderPartnerList = (
                                          members: typeof projPartners,
                                        ) => (
                                          <p
                                            style={{
                                              fontSize: "0.78rem",
                                              lineHeight: 1.9,
                                              margin: 0,
                                            }}
                                          >
                                            {members.map((pn, pi) => (
                                              <span key={pn.id}>
                                                {pi > 0 && (
                                                  <span
                                                    style={{
                                                      color:
                                                        "rgba(255,255,255,0.25)",
                                                      margin: "0 0.25rem",
                                                    }}
                                                  >
                                                    ·
                                                  </span>
                                                )}
                                                <button
                                                  onClick={() => {
                                                    enterClickState1(pn);
                                                  }}
                                                  style={{
                                                    background: "none",
                                                    border: "none",
                                                    padding: 0,
                                                    color:
                                                      "rgba(255,255,255,0.65)",
                                                    cursor: "pointer",
                                                    font: "inherit",
                                                    fontSize: "0.78rem",
                                                    textDecoration: "none",
                                                  }}
                                                  onMouseEnter={(e) => {
                                                    e.currentTarget.style.color =
                                                      "white";
                                                    const pId =
                                                      pn.partner?.airtable_id;
                                                    const role =
                                                      pId &&
                                                      pd?.linked_lead_org?.includes(
                                                        pId,
                                                      )
                                                        ? "Project Lead"
                                                        : pId &&
                                                            pd?.linked_supporting_org?.includes(
                                                              pId,
                                                            )
                                                          ? "Collaborating Partner"
                                                          : null;
                                                    if (role) {
                                                      const rect =
                                                        e.currentTarget.getBoundingClientRect();
                                                      setPartnerTooltip({
                                                        text: role,
                                                        x:
                                                          rect.left +
                                                          rect.width / 2,
                                                        y: rect.top - 1,
                                                      });
                                                    }
                                                  }}
                                                  onMouseLeave={(e) => {
                                                    e.currentTarget.style.color =
                                                      "rgba(255,255,255,0.65)";
                                                    setPartnerTooltip(null);
                                                  }}
                                                >
                                                  {pn.partner?.org_short_name ??
                                                    pn.name}
                                                </button>
                                              </span>
                                            ))}
                                          </p>
                                        );
                                        return (
                                          <div
                                            style={{
                                              display: "flex",
                                              flexDirection: "column",
                                              gap: "0.5rem",
                                            }}
                                          >
                                            {leadPartners.length > 0 && (
                                              <div>
                                                <p
                                                  style={{
                                                    fontSize: "0.62rem",
                                                    fontWeight: 700,
                                                    letterSpacing: "0.1em",
                                                    textTransform: "uppercase",
                                                    color:
                                                      "rgba(255,255,255,0.35)",
                                                    margin: "0 0 0.2rem",
                                                  }}
                                                >
                                                  Project Lead Partners
                                                </p>
                                                {renderPartnerList(
                                                  leadPartners,
                                                )}
                                              </div>
                                            )}
                                            {otherPartners.length > 0 && (
                                              <div>
                                                <p
                                                  style={{
                                                    fontSize: "0.62rem",
                                                    fontWeight: 700,
                                                    letterSpacing: "0.1em",
                                                    textTransform: "uppercase",
                                                    color:
                                                      "rgba(255,255,255,0.35)",
                                                    margin: "0 0 0.2rem",
                                                  }}
                                                >
                                                  Collaborating &amp;
                                                  Implementing Partners
                                                </p>
                                                {renderPartnerList(
                                                  otherPartners,
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* ── Donor detail panel ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {clickedNode &&
          clickedNode.label === "donor" &&
          (() => {
            const p = clickedNode.partner;
            const name =
              p?.org_short_name?.trim() ?? clickedNode.name ?? "Donor";
            const fullName = p?.org_full_name?.trim() ?? "";
            const logoSlug = toLogoSlug(name);

            const closeDonor = () => {
              setClickedNode(null);
              setTappedNodeId(null);
              setHoveredPartner(null);
              router.replace(pathname);
            };

            return (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 60,
                  display: "flex",
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,0.55)",
                    pointerEvents: "all",
                  }}
                  onClick={closeDonor}
                />
                <motion.div
                  key={`donor-panel-${clickedNode.id}`}
                  initial={isMobile ? { y: "100%" } : { x: "-100%" }}
                  animate={isMobile ? { y: 0 } : { x: 0 }}
                  exit={isMobile ? { y: "100%" } : { x: "-100%" }}
                  transition={{
                    type: "tween",
                    ease: "easeInOut",
                    duration: 0.18,
                  }}
                  style={
                    isMobile
                      ? {
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: sheetSnap === "full" ? "100dvh" : "50dvh",
                          transition: "height 0.3s ease",
                          pointerEvents: "all",
                          zIndex: 1,
                          background: "rgba(8,8,8,0.96)",
                          backdropFilter: "blur(12px)",
                          WebkitBackdropFilter: "blur(12px)",
                          borderTop: "1px solid rgba(255,255,255,0.12)",
                          borderTopLeftRadius: sheetSnap === "full" ? 0 : 16,
                          borderTopRightRadius: sheetSnap === "full" ? 0 : 16,
                          color: "white",
                          display: "flex",
                          flexDirection: "column",
                          overflow: "hidden",
                        }
                      : {
                          width: "33.33vw",
                          minWidth: 360,
                          maxWidth: 700,
                          height: "100%",
                          pointerEvents: "all",
                          position: "relative",
                          zIndex: 1,
                          background: "rgba(8,8,8,0.96)",
                          backdropFilter: "blur(12px)",
                          WebkitBackdropFilter: "blur(12px)",
                          borderRight: "1px solid rgba(255,255,255,0.08)",
                          color: "white",
                          display: "flex",
                          flexDirection: "column",
                          overflow: "hidden",
                        }
                  }
                  data-modal="true"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Mobile drag handle */}
                  {isMobile && (
                    <div
                      onTouchStart={(e) => {
                        sheetTouchStartY.current = e.touches[0].clientY;
                      }}
                      onTouchEnd={(e) => {
                        const dy =
                          e.changedTouches[0].clientY -
                          sheetTouchStartY.current;
                        if (dy < -30) setSheetSnap("full");
                        else if (dy > 30) {
                          if (sheetSnap === "full") setSheetSnap("half");
                          else closeDonor();
                        }
                      }}
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        padding: "12px 0 4px",
                        cursor: "grab",
                        touchAction: "none",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 4,
                          borderRadius: 2,
                          background: "rgba(255,255,255,0.3)",
                        }}
                      />
                    </div>
                  )}
                  {/* Header */}
                  <div
                    style={{
                      padding: isMobile
                        ? "1rem 1.5rem 1rem"
                        : "2.5rem 2.5rem 1.25rem",
                      flexShrink: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "1rem",
                      }}
                    >
                      {/* Flag */}
                      <div
                        style={{
                          flexShrink: 0,
                          width: 56,
                          height: 56,
                          border: "1px solid rgba(0,0,0,0.12)",
                          borderRadius: 8,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "white",
                          overflow: "hidden",
                        }}
                      >
                        <img
                          src={`/logos/countries/${logoSlug}.svg`}
                          alt={name}
                          style={{
                            width: "80%",
                            height: "80%",
                            objectFit: "contain",
                          }}
                        />
                      </div>
                      {/* Title */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: "0.65rem",
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: "#F1B434",
                            margin: "0 0 0.3rem",
                          }}
                        >
                          Donor Partner
                        </p>
                        <h1
                          style={{
                            color: "white",
                            fontWeight: 800,
                            fontSize: "1.1rem",
                            lineHeight: 1.2,
                            margin: 0,
                            textTransform: "uppercase",
                            letterSpacing: "0.02em",
                          }}
                        >
                          {name}
                        </h1>
                        {fullName && fullName !== name && (
                          <p
                            style={{
                              color: "rgba(255,255,255,0.55)",
                              fontSize: "0.78rem",
                              margin: "0.25rem 0 0",
                              lineHeight: 1.4,
                            }}
                          >
                            {fullName}
                          </p>
                        )}
                      </div>
                      {/* Close */}
                      <button
                        onClick={closeDonor}
                        style={{
                          flexShrink: 0,
                          background: "none",
                          border: "1px solid rgba(255,255,255,0.2)",
                          borderRadius: "50%",
                          color: "white",
                          width: isMobile ? 40 : 32,
                          height: isMobile ? 40 : 32,
                          fontSize: isMobile ? "1.4rem" : "1.1rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      padding: isMobile ? "0 1.5rem 1.5rem" : "0 2.5rem 2.5rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "1.75rem",
                    }}
                    data-modal="true"
                  >
                    {/* Total contribution */}
                    {p?.total_grant_size && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.4rem",
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
                          Total Contribution to CRAF&apos;d
                        </p>
                        <p
                          style={{
                            fontWeight: 800,
                            fontSize: "2.8rem",
                            color: "white",
                            margin: 0,
                            lineHeight: 1,
                          }}
                        >
                          {formatGrantSize(p.total_grant_size)}
                        </p>
                      </div>
                    )}

                    {/* Per-project sections */}
                    {[...parseProjects(p?.relational_project)].map((proj) => {
                      const pd = projectsById[proj];
                      if (!pd) return null;
                      return (
                        <div
                          key={proj}
                          style={{
                            borderTop: "1px solid rgba(255,255,255,0.08)",
                            paddingTop: "1.25rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "1rem",
                          }}
                        >
                          <h3
                            style={{
                              fontWeight: 800,
                              fontSize: "1.05rem",
                              color: "white",
                              margin: 0,
                            }}
                          >
                            {pd.full_title ?? pd.project_label ?? proj}
                          </h3>
                          {pd.project_blurb &&
                            pd.project_blurb.trim() !== "N/A" && (
                              <p
                                style={{
                                  color: "rgba(255,255,255,0.72)",
                                  fontSize: "0.9rem",
                                  lineHeight: 1.75,
                                  margin: 0,
                                }}
                              >
                                {pd.project_blurb}
                              </p>
                            )}
                          {pd.grant_size && (
                            <div
                              style={{
                                display: "flex",
                                gap: "0.5rem",
                                flexWrap: "wrap",
                              }}
                            >
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.3rem",
                                  background: "rgba(241,180,52,0.12)",
                                  border: "1px solid rgba(241,180,52,0.35)",
                                  borderRadius: 6,
                                  padding: "0.2rem 0.55rem",
                                  fontSize: "0.9rem",
                                  fontWeight: 700,
                                  color: "#F1B434",
                                }}
                              >
                                {formatGrantSize(pd.grant_size)}
                              </span>
                              {pd.duration_months && (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    background: "rgba(255,255,255,0.06)",
                                    border: "1px solid rgba(255,255,255,0.15)",
                                    borderRadius: 6,
                                    padding: "0.2rem 0.55rem",
                                    fontSize: "0.9rem",
                                    fontWeight: 700,
                                    color: "rgba(255,255,255,0.7)",
                                  }}
                                >
                                  {pd.duration_months} months
                                </span>
                              )}
                            </div>
                          )}
                          {pd.project_url && (
                            <a
                              href={pd.project_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                background: "#F1B434",
                                color: "#000",
                                fontWeight: 800,
                                fontSize: "0.72rem",
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                border: "none",
                                borderRadius: 6,
                                padding: "0.55rem 1rem",
                                cursor: "pointer",
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                alignSelf: "flex-start",
                                transition: "all 0.2s ease",
                              }}
                              onMouseEnter={(e) => {
                                (
                                  e.currentTarget as HTMLAnchorElement
                                ).style.transform = "translateY(-2px)";
                                (
                                  e.currentTarget as HTMLAnchorElement
                                ).style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
                              }}
                              onMouseLeave={(e) => {
                                (
                                  e.currentTarget as HTMLAnchorElement
                                ).style.transform = "translateY(0)";
                                (
                                  e.currentTarget as HTMLAnchorElement
                                ).style.boxShadow = "none";
                              }}
                            >
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 16 16"
                                fill="none"
                                style={{ flexShrink: 0 }}
                              >
                                <path
                                  d="M2 8h12M10 6l2 2-2 2"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              Visit project page
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              </div>
            );
          })()}
      </AnimatePresence>

      {/* ── Partner role tooltip ──────────────────────────────────────────────── */}
      {partnerTooltip && (
        <div
          style={{
            position: "fixed",
            left: partnerTooltip.x,
            top: partnerTooltip.y,
            transform: "translate(-50%, calc(-100% - 2px))",
            zIndex: 200,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              background: "rgba(15,15,15,0.95)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 7,
              padding: "0.3rem 0.7rem",
              fontSize: "0.67rem",
              fontWeight: 600,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.8)",
              whiteSpace: "nowrap",
              position: "relative",
            }}
          >
            {partnerTooltip.text}
            {/* Arrow pointing down */}
            <span
              style={{
                position: "absolute",
                bottom: -6,
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "6px solid rgba(15,15,15,0.95)",
              }}
            />
            {/* Arrow border (outline) */}
            <span
              style={{
                position: "absolute",
                bottom: -8,
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "7px solid transparent",
                borderRight: "7px solid transparent",
                borderTop: "7px solid rgba(255,255,255,0.14)",
                zIndex: -1,
              }}
            />
          </div>
        </div>
      )}

      {/* ── Search UI ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
        onMouseEnter={() => setSearchOpen(true)}
        onMouseLeave={() => {
          if (!searchQuery && !searchLocked) setSearchOpen(false);
        }}
      >
        <div
          style={{
            overflow: "hidden",
            width: searchOpen ? 240 : 0,
            transition: "width 0.3s ease",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              position: "relative",
              width: 240,
              display: "flex",
              alignItems: "center",
            }}
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search partners…"
              style={{
                width: "100%",
                padding: "0.5rem 2rem 0.5rem 0.85rem",
                background: "rgba(0,0,0,0.65)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 20,
                color: "white",
                fontSize: "0.82rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: 9,
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  fontSize: "1rem",
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            if (searchLocked) {
              setSearchLocked(false);
              setSearchOpen(false);
              setSearchQuery("");
            } else {
              setSearchLocked(true);
              setSearchOpen(true);
            }
          }}
          style={{
            width: 36,
            height: 36,
            flexShrink: 0,
            borderRadius: "50%",
            background: "#000",
            border: "1px solid rgba(255,255,255,0.22)",
            color: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label="Search partners"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="6.5" cy="6.5" r="5" stroke="white" strokeWidth="1.5" />
            <line
              x1="10.5"
              y1="10.5"
              x2="14"
              y2="14"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* ── Footnote ──────────────────────────────────────────────────────────── */}
      <p
        style={{
          position: "fixed",
          bottom: 16,
          right: 20,
          zIndex: 30,
          fontSize: "0.68rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "white",
          opacity: 0.65,
          margin: 0,
          pointerEvents: "none",
          fontFamily: "inherit",
          textShadow: "0 1px 4px rgba(0,0,0,0.6)",
        }}
      >
        As of {asOf}
      </p>
    </div>
  );
}
