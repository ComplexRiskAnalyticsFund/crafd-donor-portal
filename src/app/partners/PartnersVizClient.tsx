"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { HexNode } from "@/app/partners/lib/label";
import type { CrafdProject } from "@/types";
import { cn } from "@/lib/utils";
import { thumbLogoPath } from "@/lib/logos";

import {
  SQRT3,
  HEX_SIZE,
  hexPathFlat,
  fillFor,
  strokeFor,
  strokeWidthFor,
  toLogoSlug,
  parseProjects,
  projectsOverlap,
  findProjectHub,
} from "./lib/utils";
import { usePanZoom } from "./hooks/usePanZoom";
import { useHexAnimation } from "./hooks/useHexAnimation";
import { EcosystemPanel } from "./EcosystemModal";
import { DonorPanel } from "./DonorModal";

const KIND_ORDER: Record<HexNode["kind"], number> = {
  outline: 0,
  partner: 1,
  additional: 1,
  label: 2,
  center: 3,
};

function hexFallbackText(name: string, r: number) {
  const words = name.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > 11) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  const fontSize = Math.round(r * 0.2);
  const lineH = fontSize * 1.25;
  const totalSpan = (lines.length - 1) * lineH;
  return lines.map((line, i) => (
    <text
      key={i}
      x={0}
      y={-totalSpan / 2 + i * lineH + fontSize * 0.35}
      textAnchor="middle"
      fontSize={fontSize}
      fill="white"
      fontWeight={700}
      letterSpacing="0.01em"
    >
      {line}
    </text>
  ));
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
  const [clickedNode, setClickedNode] = useState<HexNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLocked, setSearchLocked] = useState(false);
  const [openProjects, setOpenProjects] = useState<Set<string>>(
    () => new Set(),
  );
  const [isMobile, setIsMobile] = useState(false);
  const [tappedNodeId, setTappedNodeId] = useState<string | null>(null);
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);
  const [hoveredOrgNodeId, setHoveredOrgNodeId] = useState<string | null>(null);
  const [vizBiasX, setVizBiasX] = useState(0);
  const [sheetSnap, setSheetSnap] = useState<"half" | "full">("half");

  const deferredSearch = useDeferredValue(searchQuery);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const svgRef = useRef<SVGSVGElement>(null);
  const isMobileRef = useRef(isMobile);
  const flyBackRef = useRef<(() => void) | null>(null);

  const closeAll = useCallback(() => {
    setLockedGroup(null);
    setLockedFeature(null);
    setLockedSourceNode(null);
    setClickedNode(null);
    setTappedNodeId(null);
    setHoveredPartner(null);
    router.replace(pathname);
    flyBackRef.current?.();
  }, [router, pathname]);

  const closeDonor = useCallback(() => {
    setClickedNode(null);
    setTappedNodeId(null);
    setHoveredPartner(null);
    router.replace(pathname);
  }, [router, pathname]);

  const {
    pan,
    scale,
    panGroupRef,
    handleDoubleClick,
    svgTouchHandlers,
    touchMovedRef,
    flyToNodes,
    flyBack,
  } = usePanZoom({ svgRef, closeAll });

  useEffect(() => {
    flyBackRef.current = flyBack;
  });

  const hasUrlState = !!(
    searchParams.get("projects") ||
    searchParams.get("org") ||
    searchParams.get("partner")
  );
  useHexAnimation({ renderNodes, svgRef, isMobileRef, skipIntro: hasUrlState });

  useEffect(() => {
    isMobileRef.current = isMobile;
  }, [isMobile]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Prevent white body background showing as a strip (100vw vs scrollbar width)
  useEffect(() => {
    const prev = {
      overflow: document.body.style.overflow,
      bg: document.body.style.background,
    };
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.background = "var(--color-crafd-bg)";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = prev.overflow;
      document.body.style.background = prev.bg;
    };
  }, []);

  // Shift the viz right to center in the visible area beside the panel
  const isModalOpen = lockedGroup !== null && clickedNode === null;
  useEffect(() => {
    if (isMobile || !isModalOpen) {
      setVizBiasX(0);
      return;
    }
    const panelPx = Math.min(window.innerWidth / 3, 700);
    setVizBiasX(panelPx / 2);
  }, [isModalOpen, isMobile]);

  useEffect(() => {
    setSheetSnap("half");
  }, [lockedFeature, clickedNode]);

  useEffect(() => {
    setRenderNodes(initialNodes);
  }, [initialNodes]);

  const nodeById = useMemo(() => {
    const m = new Map<string, HexNode>();
    for (const n of renderNodes) m.set(n.id, n);
    return m;
  }, [renderNodes]);

  // Restore modal state from URL on mount (enables shareable links)
  useEffect(() => {
    const projectsParam = searchParams.get("projects");
    const orgParam = searchParams.get("org");
    const partnerParam = searchParams.get("partner");
    const isMobileNow =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches;
    const panelPx = isMobileNow ? 0 : Math.min(window.innerWidth / 3, 700);

    if (projectsParam) {
      const peerNodes = initialNodes.filter(
        (n) =>
          n.kind === "partner" &&
          projectsOverlap(n.partner?.relational_project, projectsParam),
      );
      const peers = new Set(peerNodes.map((n) => n.id));
      if (peers.size > 0) {
        setLockedGroup(peers);
        setLockedFeature(projectsParam);
        if (orgParam) {
          const sourceNode = initialNodes.find(
            (n) => n.kind === "partner" && n.partner?.airtable_id === orgParam,
          );
          if (sourceNode) setLockedSourceNode(sourceNode);
        }
        if (!isMobileNow) flyToNodes(peerNodes, panelPx / 2);
      }
    } else if (orgParam) {
      const sourceNode = initialNodes.find(
        (n) => n.kind === "partner" && n.partner?.airtable_id === orgParam,
      );
      if (sourceNode) {
        setLockedGroup(new Set([sourceNode.id]));
        setLockedFeature("");
        setLockedSourceNode(sourceNode);
        if (!isMobileNow) flyToNodes([sourceNode], panelPx / 2);
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
          setClickedNode(node);
        } else {
          const rf = node.partner?.relational_project;
          if (rf && rf.length > 0) {
            const rfStr = rf.join(",");
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

  const enterClickState1 = useCallback((n: HexNode) => {
    const rf = n.partner?.relational_project;
    const rfStr = rf && rf.length > 0 ? rf.join(",") : "";
    const peerNodes =
      rf && rf.length > 0
        ? renderNodes.filter(
            (node) =>
              node.kind === "partner" &&
              node.id !== n.id &&
              projectsOverlap(node.partner?.relational_project, rf),
          )
        : [];
    const peers = new Set(peerNodes.map((node) => node.id));
    setHoveredPartner(null);
    setHoveredLabel(null);
    setClickedNode(null);
    setTappedNodeId(null);
    setLockedGroup(new Set([n.id, ...peers]));
    setLockedFeature(rfStr);
    setLockedSourceNode(n);
    setOpenProjects(new Set(rf ?? []));
    const orgId = n.partner?.airtable_id;
    const orgParam = orgId ? `&org=${orgId}` : "";
    if (rfStr) {
      router.replace(`${pathname}?projects=${rfStr}${orgParam}`);
    } else if (orgId) {
      router.replace(`${pathname}?org=${orgId}`);
    } else {
      router.replace(pathname);
    }
    // Auto-zoom to frame all ecosystem nodes in the visible right area
    if (!isMobile) {
      const panelPx = Math.min(window.innerWidth / 3, 700);
      flyToNodes([n, ...peerNodes], panelPx / 2);
    }
  }, [renderNodes, isMobile, router, pathname, flyToNodes]);

  // ── Memos ──────────────────────────────────────────────────────────────────

  // Background hex grid — bucket by rounded opacity so we render ~10 <path>
  // elements instead of ~400 individual ones.
  const bgHexBuckets = useMemo(() => {
    const RANGE = isMobile ? 10 : 28;
    const FADE_START = 200;
    const FADE_END = isMobile ? 900 : 2400;
    const BUCKET_COUNT = 10;
    const buckets: string[][] = Array.from({ length: BUCKET_COUNT + 1 }, () => []);
    for (let q = -RANGE; q <= RANGE; q++) {
      for (let r = -RANGE; r <= RANGE; r++) {
        const x = HEX_SIZE * 1.5 * q;
        const y = HEX_SIZE * SQRT3 * (r + q / 2);
        const dist = Math.sqrt(x * x + y * y);
        if (dist > FADE_END) continue;
        const t = Math.max(0, (dist - FADE_START) / (FADE_END - FADE_START));
        const opacity = 0.9 * (1 - t);
        const bucket = Math.round(opacity * BUCKET_COUNT);
        buckets[bucket].push(hexPathFlat(x, y, HEX_SIZE));
      }
    }
    return buckets
      .map((paths, i) => ({
        d: paths.join(" "),
        opacity: i / BUCKET_COUNT,
      }))
      .filter((b) => b.d.length > 0);
  }, [isMobile]);

  const hoveredPartnerNode = useMemo(
    () =>
      hoveredPartner
        ? (nodeById.get(hoveredPartner) ?? null)
        : null,
    [hoveredPartner, nodeById],
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
    return projects.flatMap((proj) => {
      const projNodes = lockedNodes.filter((n) =>
        parseProjects(n.partner?.relational_project).has(proj),
      );
      const pd = projectsById[proj];
      if (projNodes.length < 2 || !pd) return [];
      const hub = findProjectHub(projNodes, pd, lockedSourceNode);
      return projNodes
        .filter((n) => n.id !== hub.id)
        .map((spoke) => ({
          hub,
          spoke,
          isSourceLine:
            spoke.id === lockedSourceNode?.id ||
            hub.id === lockedSourceNode?.id,
        }));
    });
  }, [lockedGroup, lockedNodes, lockedFeature, lockedSourceNode, projectsById]);

  const hubIds = useMemo(() => {
    const set = new Set<string>();
    for (const { hub } of projectLineData) set.add(hub.id);
    return set;
  }, [projectLineData]);

  const hexPaths = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of renderNodes) {
      if (n.kind === "partner" || n.kind === "additional") {
        m.set(n.id, hexPathFlat(0, 0, n.r));
        // outer/inner paths only needed for hub nodes — computed lazily below
      } else {
        m.set(n.id, hexPathFlat(n.x, n.y, n.r));
      }
    }
    return m;
  }, [renderNodes]);

  // Outer/inner ring paths — only for hub nodes (typically 3-5), not all ~100 partners
  const hubRingPaths = useMemo(() => {
    const m = new Map<string, { outer: string; inner: string }>();
    for (const id of hubIds) {
      const n = nodeById.get(id);
      if (!n) continue;
      m.set(id, {
        outer: hexPathFlat(0, 0, n.r * 1.22),
        inner: hexPathFlat(0, 0, n.r * 1.05),
      });
    }
    return m;
  }, [hubIds, nodeById]);

  // Base kind ordering — stable across hover/tap, only changes when nodes change.
  // Hovered/locked/clicked nodes are rendered in separate SVG layers on top,
  // so this only determines the z-order of the background mass.
  const baseOrdered = useMemo(() => {
    return [...renderNodes].sort(
      (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
    );
  }, [renderNodes]);

  // Full z-ordered list — on mobile, skip hover-based re-sorting (hover is N/A,
  // hovered/locked nodes are rendered in separate overlay passes anyway).
  const ordered = useMemo(() => {
    if (isMobile) {
      if (!lockedGroup) return baseOrdered;
      return [...baseOrdered].sort((a, b) => {
        const pa =
          a.kind === "partner" && lockedGroup.has(a.id)
            ? hubIds.has(a.id)
              ? 200
              : a.id === lockedSourceNode?.id
                ? 150
                : 100
            : 0;
        const pb =
          b.kind === "partner" && lockedGroup.has(b.id)
            ? hubIds.has(b.id)
              ? 200
              : b.id === lockedSourceNode?.id
                ? 150
                : 100
            : 0;
        return pa - pb;
      });
    }

    function priority(n: HexNode): number {
      if (lockedGroup !== null && n.kind === "partner") {
        if (hubIds.has(n.id)) return 200;
        if (n.id === lockedSourceNode?.id) return 150;
        if (lockedGroup.has(n.id)) return 100;
      }
      if (hoveredPartnerNode && n.kind === "partner") {
        if (n.id === hoveredPartnerNode.id) return 100;
        if (relationalPeers.has(n.id)) return 50;
      }
      return KIND_ORDER[n.kind];
    }
    return [...renderNodes].sort((a, b) => priority(a) - priority(b));
  }, [
    isMobile,
    baseOrdered,
    renderNodes,
    hoveredPartnerNode,
    relationalPeers,
    lockedGroup,
    lockedSourceNode,
    hubIds,
  ]);

  // ── Render ─────────────────────────────────────────────────────────────────

  function renderNode(n: HexNode): React.ReactNode {
    let nodeOpacity = (n.kind === "partner" || n.kind === "additional") ? 0.95 : 1;
    let nodeScale = 1;
    let highlight = false;

    if (lockedGroup !== null) {
      if (n.kind === "outline") nodeOpacity = 0.1;
      else if (n.kind === "center") nodeOpacity = 0.18;
      else if (n.kind === "label") nodeOpacity = 0.07;
      else if (n.id === lockedSourceNode?.id) {
        nodeOpacity = 1;
        nodeScale = 1.15;
      } else if (lockedGroup.has(n.id)) {
        if (hoveredOrgNodeId) {
          nodeOpacity = n.id === hoveredOrgNodeId ? 1 : 0.3;
          nodeScale = n.id === hoveredOrgNodeId ? 1.5 : 1.0;
        } else if (hoveredProject) {
          const inProject = parseProjects(n.partner?.relational_project).has(hoveredProject);
          nodeOpacity = inProject ? 1 : 0.25;
          nodeScale = inProject ? 1.4 : 1.0;
        } else {
          nodeOpacity = 1;
          nodeScale = 1.15;
        }
      } else {
        nodeOpacity = 0.07;
      }
    } else if (clickedNode !== null) {
      if (n.kind === "label") nodeOpacity = 0.4;
      else if (n.kind === "partner") {
        if (n.id === clickedNode.id) {
          nodeScale = 1.5;
          nodeOpacity = 1;
        } else {
          nodeOpacity = 0.35;
        }
      }
    } else if (hoveredPartner !== null && hoveredPartnerNode) {
      if (n.kind === "label") nodeOpacity = 0.4;
      else if (n.kind === "partner") {
        const rf = hoveredPartnerNode.partner?.relational_project;
        if (n.id === hoveredPartnerNode.id) {
          nodeScale = 1.5;
          nodeOpacity = 1;
          highlight = true;
        } else if (rf && projectsOverlap(n.partner?.relational_project, rf)) {
          nodeOpacity = 1;
          highlight = true;
        } else {
          nodeOpacity = 0.35;
        }
      }
    } else if (deferredSearch.trim()) {
      if (n.kind === "partner") {
        const q = deferredSearch.toLowerCase();
        const hit =
          (n.name ?? "").toLowerCase().includes(q) ||
          (n.partner?.org_full_name ?? "").toLowerCase().includes(q);
        nodeOpacity = hit ? 1 : 0.12;
      }
    } else if (hoveredLabel !== null) {
      const isSameGroup =
        (n.kind === "label" || n.kind === "partner" || n.kind === "additional") && n.label === hoveredLabel;
      if (n.kind === "outline" || n.kind === "center") nodeOpacity = 1;
      else if (isSameGroup) nodeOpacity = n.kind === "partner" ? 0.9 : 1;
      else nodeOpacity = 0.2;
    }

    // Snap opacity to nearest CSS-defined step to avoid inline style objects
    const opacityStr = String(Math.round(nodeOpacity * 100) / 100);

    if (n.kind === "additional") {
      return (
        <g
          key={n.id}
          className="hex-node"
          data-node="true"
          data-kind="additional"
          data-label={n.label}
          data-cx={n.x}
          data-cy={n.y}
          data-opacity={opacityStr}
        >
          <g transform={`translate(${n.x},${n.y})`}>
            <path
              d={hexPaths.get(n.id) ?? ""}
              fill={fillFor(n, highlight)}
              stroke={strokeFor(n)}
              strokeWidth={strokeWidthFor(n)}
            />
            <text
              x={0}
              y={-4}
              textAnchor="middle"
              fontSize="42"
              fill="white"
              fontWeight={1000}
              fontFamily="inherit"
            >
              {n.count}
            </text>
            {n.name?.split("\n").map((line, idx) => (
              <text
                key={idx}
                x={0}
                y={20 + idx * 13}
                textAnchor="middle"
                fontSize="12"
                fill="white"
                fontWeight={1000}
              >
                {line}
              </text>
            ))}
          </g>
        </g>
      );
    }

    if (n.kind !== "partner") {
      return (
        <g
          key={n.id}
          className="hex-node"
          data-node="true"
          data-kind={n.kind}
          data-opacity={opacityStr}
          onMouseEnter={() => {
            if (lockedGroup || isMobile) return;
            if (n.kind === "label") setHoveredLabel(n.label ?? null);
          }}
          onMouseLeave={() => {
            if (lockedGroup || isMobile) return;
            if (n.kind === "label") setHoveredLabel(null);
          }}
          style={{
            cursor: n.kind === "label" ? "pointer" : "default",
          }}
        >
          <path
            d={hexPaths.get(n.id) ?? ""}
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

    const boxW = n.r * 1.1;
    const boxH = n.r * 0.75;
    const isLocked = lockedGroup?.has(n.id) ?? false;
    const isSource = lockedGroup !== null && n.id === lockedSourceNode?.id;

    return (
      <g
        key={n.id}
        className="hex-node"
        data-node="true"
        data-kind="partner"
        data-id={n.id}
        data-label={n.label}
        data-cx={n.x}
        data-cy={n.y}
        data-opacity={opacityStr}
        onMouseEnter={() => {
          if (lockedGroup || isMobile) return;
          setHoveredPartner(n.id);
        }}
        onMouseLeave={() => {
          if (lockedGroup || isMobile) return;
          setHoveredPartner(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
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
            setClickedNode(n);
            router.replace(
              `${pathname}?partner=${encodeURIComponent(n.partner?.org_short_name ?? n.name ?? "")}`,
            );
            return;
          }
          if (lockedGroup !== null) {
            if (isLocked) enterClickState1(n);
          } else {
            enterClickState1(n);
          }
        }}
        style={{
          cursor: lockedGroup !== null ? (isLocked ? "pointer" : "default") : "pointer",
        }}
      >
        <g transform={`translate(${n.x},${n.y})`}>
          {hubIds.has(n.id) && hubRingPaths.get(n.id) && (
            <>
              <path
                d={hubRingPaths.get(n.id)!.outer}
                fill="rgba(255,255,255,0.12)"
                stroke="white"
                strokeWidth={4}
                strokeLinecap="round"
                style={{ fillOpacity: 0.28, strokeOpacity: 0.7 }}
              />
              {([0, 0.8, 1.6] as const).map((delay) => (
                <path
                  key={delay}
                  d={hubRingPaths.get(n.id)!.inner}
                  fill="rgba(255,255,255,0.10)"
                  stroke="white"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  className="hub-ring"
                  style={{ animationDelay: `${delay}s`, transformOrigin: "0 0" }}
                />
              ))}
            </>
          )}
          <g
            style={{
              transformOrigin: "0 0",
              transform: nodeScale !== 1 ? `scale(${nodeScale})` : undefined,
              transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            <path
              d={hexPaths.get(n.id) ?? ""}
              fill={fillFor(n, highlight)}
              stroke={isSource ? "white" : strokeFor(n)}
              strokeWidth={isSource ? 5 : strokeWidthFor(n)}
            />
            {n.label === "donor" ? (
              <image
                href={`/logos/countries/${toLogoSlug(n.partner?.org_short_name ?? n.name ?? "")}.svg`}
                x={-boxW / 2}
                y={-boxH / 2}
                width={boxW}
                height={boxH}
                preserveAspectRatio="xMidYMid meet"
              />
            ) : n.partner?.logo_slug ? (
              <image
                href={thumbLogoPath(n.partner.logo_slug)}
                x={-boxW / 2}
                y={-boxH / 2}
                width={boxW}
                height={boxH}
                preserveAspectRatio="xMidYMid meet"
                imageRendering={isMobile ? "auto" : "optimizeQuality"}
              />
            ) : n.name ? (
              hexFallbackText(n.name, n.r)
            ) : null}
          </g>
        </g>
      </g>
    );
  }

  return (
    <div className="fixed inset-0 bg-crafd-bg">
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
        {...svgTouchHandlers}
      >
        {/* SVG backdrop — handles click-to-exit without an HTML overlay div */}
        {lockedGroup !== null && (
          <rect
            x="-900"
            y="-500"
            width="1800"
            height="1000"
            fill="transparent"
            style={{ cursor: "default" }}
            onClick={closeAll}
          />
        )}

        <g style={{ transform: `translateX(${vizBiasX}px)`, transition: "transform 0.35s ease" }}>
        <g
          ref={panGroupRef}
          transform={`translate(${pan.x},${pan.y}) scale(${scale})`}
        >
          {/* Background hex grid — bucketed into ~10 <path> elements instead of ~400 */}
          <g
            style={{
              opacity: lockedGroup !== null ? 0.18 : 1,
              transition: "opacity 0.3s",
            }}
          >
            {bgHexBuckets.map(({ d, opacity }, i) => (
              <path
                key={`bg-bucket-${i}`}
                suppressHydrationWarning
                d={d}
                fill="none"
                stroke="white"
                strokeWidth={1.5}
                strokeOpacity={opacity}
              />
            ))}
          </g>

          {/* Background hex nodes — excludes hovered, locked, and clicked-donor partners */}
          {ordered.map((n) => {
            if (n.kind === "partner" && (lockedGroup?.has(n.id) || n.id === hoveredPartner || n.id === clickedNode?.id)) return null;
            return renderNode(n);
          })}

          {/* Hub-spoke connecting lines — above dimmed hexes, below locked hexes */}
          {projectLineData.map(({ hub, spoke, isSourceLine }, i) => {
            const dx = spoke.x - hub.x;
            const dy = spoke.y - hub.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) return null;
            const ux = dx / dist, uy = dy / dist;
            const x1 = hub.x + ux * hub.r, y1 = hub.y + uy * hub.r;
            const x2 = spoke.x - ux * spoke.r, y2 = spoke.y - uy * spoke.r;
            return (
              <g key={`conn-${i}-${hub.id}-${spoke.id}`}>
                {isSourceLine && (
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth={18} strokeOpacity={0.18} strokeLinecap="round" />
                )}
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth={isSourceLine ? 7 : 2.5} strokeOpacity={isSourceLine ? 0.95 : 0.7} strokeLinecap="round" />
              </g>
            );
          })}

          {/* Locked hex nodes — dimmed project-hover nodes first, focused on top */}
          {lockedGroup && ordered.map((n) => {
            if (n.kind !== "partner" || !lockedGroup.has(n.id)) return null;
            if (n.id === hoveredOrgNodeId) return null;
            if (hoveredProject && parseProjects(n.partner?.relational_project).has(hoveredProject)) return null;
            return renderNode(n);
          })}
          {hoveredProject && lockedGroup && ordered.map((n) => {
            if (n.kind !== "partner" || !lockedGroup.has(n.id) || n.id === hoveredOrgNodeId) return null;
            if (!parseProjects(n.partner?.relational_project).has(hoveredProject)) return null;
            return renderNode(n);
          })}

          {/* Hovered hex node — rendered last so it's always on top */}
          {hoveredPartner && ordered.map((n) => (n.kind === "partner" && n.id === hoveredPartner) ? renderNode(n) : null)}

          {/* Clicked donor hex — topmost so scaled hex is never occluded */}
          {clickedNode && ordered.map((n) => (n.kind === "partner" && n.id === clickedNode.id) ? renderNode(n) : null)}

          {/* Org-hovered locked node — topmost */}
          {hoveredOrgNodeId && ordered.map((n) => (n.kind === "partner" && n.id === hoveredOrgNodeId) ? renderNode(n) : null)}

        </g>
        </g>
      </svg>
      {/* ── Ecosystem panel (click state 1) ────────────────────────────────── */}
      {lockedGroup && !clickedNode && lockedFeature !== null && (
        <EcosystemPanel
          lockedFeature={lockedFeature}
          lockedSourceNode={lockedSourceNode}
          lockedNodes={lockedNodes}
          projectsById={projectsById}
          openProjects={openProjects}
          setOpenProjects={setOpenProjects}
          isMobile={isMobile}
          sheetSnap={sheetSnap}
          setSheetSnap={setSheetSnap}
          onClose={closeAll}
          onPartnerClick={enterClickState1}
          onProjectHover={setHoveredProject}
          onOrgHover={setHoveredOrgNodeId}
        />
      )}

      {/* ── Donor detail panel ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {clickedNode?.label === "donor" && (
          <DonorPanel
            key={`donor-${clickedNode.id}`}
            clickedNode={clickedNode}
            projectsById={projectsById}
            isMobile={isMobile}
            sheetSnap={sheetSnap}
            setSheetSnap={setSheetSnap}
            onClose={closeDonor}
          />
        )}
      </AnimatePresence>

      {/* ── Search — hidden when any modal is open ─────────────────────────── */}
      <div
        className={cn(
          "fixed top-5 right-5 z-40 flex items-center gap-2 transition-opacity duration-200",
          lockedGroup !== null || clickedNode !== null ? "pointer-events-none opacity-0" : "opacity-100",
        )}
        onMouseEnter={() => {
          if (!isMobile) setSearchOpen(true);
        }}
        onMouseLeave={() => {
          if (!isMobile && !searchQuery && !searchLocked) setSearchOpen(false);
        }}
      >
        <div
          className="ease flex items-center overflow-hidden transition-[width] duration-300"
          style={{ width: searchOpen ? (isMobile ? 180 : 240) : 0 }}
        >
          <div className={cn("relative flex items-center", isMobile ? "w-[180px]" : "w-60")}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search partners…"
              className="w-full rounded-[20px] border border-white/18 py-2 pr-8 pl-[0.85rem] text-sm text-white outline-none"
              style={{
                background: "rgba(0,0,0,0.65)",
                backdropFilter: "blur(10px)",
                boxSizing: "border-box",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.25 cursor-pointer border-none bg-transparent p-0 text-base leading-none text-white/50"
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
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/22 bg-black text-white"
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

      {/* ── Footnote ───────────────────────────────────────────────────────── */}
      <p
        className="pointer-events-none fixed right-4 bottom-4 z-30 m-0 rounded-md px-2.5 py-1 font-[inherit] text-xs font-semibold tracking-widest text-white uppercase"
        style={{ background: "rgba(0,0,0,0.55)" }}
      >
        As of {asOf}
      </p>
    </div>
  );
}
