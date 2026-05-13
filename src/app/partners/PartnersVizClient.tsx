"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { HexNode } from "@/lib/partners/label";
import type { CrafdProject } from "@/types";

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
} from "./utils";
import { usePanZoom } from "./hooks/usePanZoom";
import { useHexAnimation } from "./hooks/useHexAnimation";
import { EcosystemPanel } from "./EcosystemPanel";
import { DonorPanel } from "./DonorPanel";

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
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches,
  );
  const [tappedNodeId, setTappedNodeId] = useState<string | null>(null);
  const [sheetSnap, setSheetSnap] = useState<"half" | "full">("half");
  const [partnerTooltip, setPartnerTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const svgRef = useRef<SVGSVGElement>(null);
  const isMobileRef = useRef(isMobile);

  const closeAll = useCallback(() => {
    setLockedGroup(null);
    setLockedFeature(null);
    setLockedSourceNode(null);
    setEcosystemContextNode(null);
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
  } = usePanZoom({ svgRef, closeAll });

  useHexAnimation({ renderNodes, svgRef, isMobileRef });

  // Keep mobile ref in sync
  useEffect(() => {
    isMobileRef.current = isMobile;
  }, [isMobile]);

  // Detect mobile viewport
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

  // Reset bottom sheet snap when the active panel changes
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
          setClickedNode(node);
        } else {
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

  // ── Memos ──────────────────────────────────────────────────────────────────

  const bgHexes = useMemo(() => {
    const isMobileInit =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches;
    const RANGE = isMobileInit ? 14 : 28;
    const FADE_START = 200;
    const FADE_END = isMobileInit ? 1200 : 2400;
    const cells: { d: string; key: string; opacity: number }[] = [];
    for (let q = -RANGE; q <= RANGE; q++) {
      for (let r = -RANGE; r <= RANGE; r++) {
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
      if (projNodes.length < 2) return [];
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
  }, [lockedGroup, lockedNodes, lockedFeature, lockedSourceNode]);

  const hubIds = useMemo(() => {
    const set = new Set<string>();
    for (const { hub } of projectLineData) set.add(hub.id);
    return set;
  }, [projectLineData]);

  const hexPaths = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of renderNodes) {
      if (n.kind === "partner") {
        m.set(n.id, hexPathFlat(0, 0, n.r));
        m.set(`${n.id}-outer`, hexPathFlat(0, 0, n.r * 1.22));
        m.set(`${n.id}-inner`, hexPathFlat(0, 0, n.r * 1.05));
      } else {
        m.set(n.id, hexPathFlat(n.x, n.y, n.r));
      }
    }
    return m;
  }, [renderNodes]);

  const ordered = useMemo(() => {
    const hubIdSet = new Set<string>();
    if (lockedGroup && lockedFeature) {
      const lockedPartners = renderNodes.filter(
        (n) => n.kind === "partner" && lockedGroup.has(n.id),
      );
      for (const proj of parseProjects(lockedFeature)) {
        const projNodes = lockedPartners.filter((n) =>
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
        if (hub) hubIdSet.add(hub.id);
      }
    }

    function priority(n: HexNode): number {
      if (lockedGroup !== null && n.kind === "partner") {
        if (hubIdSet.has(n.id)) return 200;
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

  // ── Render ─────────────────────────────────────────────────────────────────

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

        <g
          ref={panGroupRef}
          transform={`translate(${pan.x},${pan.y}) scale(${scale})`}
        >
          {/* Background hex grid — group opacity handles lock-state dimming in one DOM update */}
          <g
            style={{
              opacity: lockedGroup !== null ? 0.18 : 1,
              transition: "opacity 0.3s",
            }}
          >
            {bgHexes.map(({ d, key, opacity }) => (
              <path
                key={key}
                suppressHydrationWarning
                d={d}
                fill="none"
                stroke="white"
                strokeWidth={1.5}
                strokeOpacity={opacity}
              />
            ))}
          </g>

          {/* Hub-spoke connecting lines — drawn under hexes */}
          {projectLineData.map(({ hub, spoke, isSourceLine }, i) => {
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
                />
              </g>
            );
          })}

          {/* Hex nodes */}
          {ordered.map((n) => {
            let nodeOpacity = n.kind === "partner" ? 0.95 : 1;
            let nodeScale = 1;
            let highlight = false;

            if (lockedGroup !== null) {
              if (n.kind === "outline") nodeOpacity = 0.1;
              else if (n.kind === "center") nodeOpacity = 0.18;
              else if (n.kind === "label") nodeOpacity = 0.07;
              else if (lockedGroup.has(n.id)) {
                nodeOpacity = 1;
                nodeScale = 1.15;
              } else {
                nodeOpacity = 0.07;
              }
            } else if (hoveredPartner !== null && hoveredPartnerNode) {
              if (n.kind === "label") nodeOpacity = 0.4;
              else if (n.kind === "partner") {
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
              if (n.kind === "outline" || n.kind === "center") nodeOpacity = 1;
              else if (isSameGroup)
                nodeOpacity = n.kind === "partner" ? 0.9 : 1;
              else nodeOpacity = 0.2;
            }

            // ── Non-partner nodes ─────────────────────────────────────────────
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

            // ── Partner nodes ─────────────────────────────────────────────────
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
                <g transform={`translate(${n.x},${n.y})`}>
                  {/* Hub glow */}
                  {hubIds.has(n.id) && (
                    <>
                      <path
                        d={hexPaths.get(`${n.id}-outer`) ?? ""}
                        fill="rgba(255,255,255,0.12)"
                        stroke="white"
                        strokeWidth={4}
                        strokeLinecap="round"
                        style={{ fillOpacity: 0.28, strokeOpacity: 0.7 }}
                      />
                      {([0, 0.8, 1.6] as const).map((delay) => (
                        <path
                          key={delay}
                          d={hexPaths.get(`${n.id}-inner`) ?? ""}
                          fill="rgba(255,255,255,0.10)"
                          stroke="white"
                          strokeWidth={2.5}
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
                  {/* Scale anchor at hex center */}
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
                      d={hexPaths.get(n.id) ?? ""}
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

      {/* ── Ecosystem panel (click state 1) ────────────────────────────────── */}
      {lockedGroup && !clickedNode && lockedFeature && (
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
          setPartnerTooltip={setPartnerTooltip}
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
            onClose={() => {
              setClickedNode(null);
              setTappedNodeId(null);
              setHoveredPartner(null);
              router.replace(pathname);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Partner role tooltip ────────────────────────────────────────────── */}
      {partnerTooltip && (
        <div
          className="pointer-events-none fixed z-200"
          style={{
            left: partnerTooltip.x,
            top: partnerTooltip.y,
            transform: "translate(-50%, calc(-100% - 2px))",
          }}
        >
          <div
            className="relative rounded-[7px] border border-white/[0.14] px-[0.7rem] py-[0.3rem] text-xs font-semibold tracking-wider whitespace-nowrap text-white/80 uppercase"
            style={{
              background: "rgba(15,15,15,0.95)",
              backdropFilter: "blur(10px)",
            }}
          >
            {partnerTooltip.text}
            <span
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2"
              style={{
                width: 0,
                height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "6px solid rgba(15,15,15,0.95)",
              }}
            />
            <span
              className="absolute -bottom-2 left-1/2 -z-1 -translate-x-1/2"
              style={{
                width: 0,
                height: 0,
                borderLeft: "7px solid transparent",
                borderRight: "7px solid transparent",
                borderTop: "7px solid rgba(255,255,255,0.14)",
              }}
            />
          </div>
        </div>
      )}

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div
        className="fixed top-5 right-5 z-40 flex items-center gap-2"
        onMouseEnter={() => {
          if (!isMobile) setSearchOpen(true);
        }}
        onMouseLeave={() => {
          if (!isMobile && !searchQuery && !searchLocked) setSearchOpen(false);
        }}
      >
        <div
          className="ease flex items-center overflow-hidden transition-[width] duration-300"
          style={{ width: searchOpen ? 240 : 0 }}
        >
          <div className="relative flex w-60 items-center">
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
        className="pointer-events-none fixed right-5 bottom-4 z-30 m-0 font-[inherit] text-xs tracking-widest text-white uppercase opacity-65"
        style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
      >
        As of {asOf}
      </p>
    </div>
  );
}
