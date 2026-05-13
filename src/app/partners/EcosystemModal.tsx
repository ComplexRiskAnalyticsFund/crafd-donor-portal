"use client";
import type { HexNode } from "@/app/partners/lib/label";
import { cn } from "@/lib/utils";
import type { CrafdProject } from "@/types";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";
import { formatGrantSize, parseProjects } from "./lib/utils";

interface EcosystemPanelProps {
  lockedFeature: string;
  lockedSourceNode: HexNode | null;
  lockedNodes: HexNode[];
  projectsById: Record<string, CrafdProject>;
  openProjects: Set<string>;
  setOpenProjects: React.Dispatch<React.SetStateAction<Set<string>>>;
  isMobile: boolean;
  sheetSnap: "half" | "full";
  setSheetSnap: (v: "half" | "full") => void;
  onClose: () => void;
  onPartnerClick: (n: HexNode) => void;
  setPartnerTooltip: (t: { text: string; x: number; y: number } | null) => void;
  onProjectHover: (project: string | null) => void;
  onOrgHover: (nodeId: string | null) => void;
}

function ProjectVisitLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-2 self-start border-b border-crafd-yellow/40 pb-px text-xs font-bold tracking-widest text-crafd-yellow uppercase no-underline transition-colors hover:border-crafd-yellow"
    >
      Visit project page
      <svg
        width="10"
        height="10"
        viewBox="0 0 12 12"
        fill="none"
        className="shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      >
        <path
          d="M2 10L10 2M10 2H5M10 2v5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}

export function EcosystemPanel({
  lockedFeature,
  lockedSourceNode,
  lockedNodes,
  projectsById,
  openProjects,
  setOpenProjects,
  isMobile,
  sheetSnap,
  setSheetSnap,
  onClose,
  onPartnerClick,
  setPartnerTooltip,
  onProjectHover,
  onOrgHover,
}: EcosystemPanelProps) {
  const sheetTouchStartY = useRef(0);
  const projects = [...parseProjects(lockedFeature)].filter(
    (proj) => proj in projectsById,
  );
  const partnerShortName =
    lockedSourceNode?.partner?.org_short_name?.trim() ??
    lockedSourceNode?.name ??
    "Partner";
  const partnerFullName = lockedSourceNode?.partner?.org_full_name?.trim();
  const orgUrl = lockedSourceNode?.partner?.org_url;

  const logoSrc =
    lockedSourceNode?.partner?.color_logo_path ??
    lockedSourceNode?.partner?.thumb_logo_path ??
    lockedSourceNode?.partner?.white_logo_path;
  const logoIsWhiteOnly =
    !lockedSourceNode?.partner?.color_logo_path &&
    !lockedSourceNode?.partner?.thumb_logo_path &&
    !!lockedSourceNode?.partner?.white_logo_path;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex">
      {/* Mobile backdrop */}
      {isMobile && (
        <div
          className="pointer-events-auto absolute inset-0 bg-black/55"
          onClick={onClose}
        />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={`cs1-panel-${lockedSourceNode?.id ?? lockedFeature}`}
          initial={isMobile ? { y: "100%" } : { x: "-100%" }}
          animate={isMobile ? { y: 0 } : { x: 0 }}
          exit={isMobile ? { y: "100%" } : { x: "-100%" }}
          transition={{ type: "tween", ease: "easeInOut", duration: 0.18 }}
          className={cn(
            "pointer-events-auto flex flex-col overflow-hidden text-white",
            isMobile ? "backdrop-blur-sm" : "backdrop-blur-md",
            isMobile
              ? "absolute inset-x-0 bottom-0 border-t border-white/12"
              : "w-1/3 max-w-175 min-w-90 border-r border-white/8",
            isMobile && sheetSnap === "full"
              ? "rounded-t-none"
              : isMobile
                ? "rounded-t-2xl"
                : "",
          )}
          style={{
            background: isMobile ? "rgba(8,8,8,0.96)" : "rgba(8,8,8,0.93)",
            ...(isMobile && {
              height: sheetSnap === "full" ? "100dvh" : "50dvh",
              transition: "height 0.3s ease",
            }),
          }}
          data-modal="true"
        >
          {/* Mobile drag handle */}
          {isMobile && (
            <div
              className="flex shrink-0 cursor-grab touch-none justify-center pt-3 pb-1"
              onTouchStart={(e) => {
                sheetTouchStartY.current = e.touches[0].clientY;
              }}
              onTouchEnd={(e) => {
                const dy =
                  e.changedTouches[0].clientY - sheetTouchStartY.current;
                if (dy < -30) setSheetSnap("full");
                else if (dy > 30) {
                  if (sheetSnap === "full") setSheetSnap("half");
                  else onClose();
                }
              }}
            >
              <div className="h-1 w-9 rounded-sm bg-white/30" />
            </div>
          )}

          {/* Sticky header */}
          <div
            className={cn(
              "flex shrink-0 flex-col gap-3",
              isMobile ? "px-6 py-4" : "px-10 pt-10 pb-4",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                {/* Logo */}
                {logoSrc && (
                  <Image
                    src={logoSrc}
                    alt={partnerShortName}
                    width={120}
                    height={40}
                    className="object-contain object-left"
                    style={{
                      height: isMobile ? 30 : 40,
                      width: "auto",
                      maxWidth: 110,
                      filter: logoIsWhiteOnly
                        ? "brightness(0) invert(1) opacity(0.7)"
                        : undefined,
                    }}
                  />
                )}

                {/* Title block */}
                <div className="flex flex-col gap-0.5">
                  <p className="m-0 text-xs font-bold tracking-widest text-white/50 uppercase">
                    Ecosystem of
                  </p>
                  <h1
                    className={cn(
                      "m-0 leading-tight font-extrabold tracking-wide text-crafd-yellow uppercase",
                      isMobile ? "text-2xl" : "text-3xl",
                    )}
                  >
                    {partnerShortName}
                  </h1>
                  {partnerFullName && partnerFullName !== partnerShortName && (
                    <p className="m-0 text-sm leading-snug text-white/65">
                      {partnerFullName}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {lockedSourceNode?.partner?.org_type && (
                      <span className="rounded-sm border border-white/12 bg-white/6 px-1.5 py-0.5 text-xs font-bold tracking-widest text-white/50 uppercase">
                        {lockedSourceNode.partner.org_type}
                      </span>
                    )}
                    {orgUrl && (
                      <a
                        href={orgUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-sm border border-white/12 bg-white/6 px-1.5 py-0.5 text-xs font-bold tracking-widest text-white/50 uppercase no-underline transition-colors hover:border-crafd-yellow/30 hover:bg-crafd-yellow/8 hover:text-crafd-yellow"
                      >
                        <svg
                          width="8"
                          height="8"
                          viewBox="0 0 12 12"
                          fill="none"
                          className="shrink-0"
                        >
                          <path
                            d="M2 10L10 2M10 2H5M10 2v5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Website
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className={cn(
                  "flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-transparent text-white",
                  isMobile ? "h-10 w-10 text-xl" : "h-8 w-8 text-lg",
                )}
              >
                ×
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div
            className={cn(
              "flex flex-1 flex-col gap-5 overflow-y-auto",
              isMobile ? "px-6 pt-3 pb-6" : "px-10 pt-4 pb-10",
            )}
            data-modal="true"
          >
            {projects.length === 0 && (
              <p className="m-0 text-sm text-white/40">No projects listed.</p>
            )}
            {projects.map((proj, idx) => {
              const pd = projectsById[proj];
              const projPartners = lockedNodes
                .filter((n) =>
                  parseProjects(n.partner?.relational_project).has(proj),
                )
                .sort((a, b) =>
                  (a.partner?.org_short_name ?? a.name ?? "").localeCompare(
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
                  className="flex flex-col border-l-4 border-crafd-yellow pl-4"
                  onMouseEnter={() => onProjectHover(proj)}
                  onMouseLeave={() => onProjectHover(null)}
                >
                  <div>
                    <button
                      onClick={toggleProj}
                      className="flex w-full cursor-pointer items-start justify-between gap-3 border-none bg-transparent p-0 pb-2 text-left text-white"
                    >
                      <h3 className="m-0 flex-1 text-base leading-tight font-extrabold">
                        {(() => {
                          const pId = lockedSourceNode?.partner?.airtable_id;
                          const isLead =
                            pId && pd?.linked_lead_org?.includes(pId);
                          const isSupporting =
                            pId && pd?.linked_supporting_org?.includes(pId);
                          const role = isLead
                            ? "Project Lead"
                            : isSupporting
                              ? "Collaborating Partner"
                              : null;
                          return role ? (
                            <span className="font-bold text-crafd-yellow">
                              {role}
                              <span className="mx-1.5 opacity-40">|</span>
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
                        className="mt-0.75 shrink-0 opacity-60"
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
                      <div className="flex flex-wrap gap-2 pb-2">
                        {pd?.grant_size && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-white/18 bg-white/8 px-2 py-0.5 text-sm font-bold tracking-wide text-white/85">
                            {formatGrantSize(pd.grant_size)}
                          </span>
                        )}
                        {pd?.duration_months && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/6 px-2 py-0.5 text-sm font-bold tracking-wide text-white/70">
                            {pd.duration_months} months
                          </span>
                        )}
                        {pd?.project_coverage && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/6 px-2 py-0.5 text-sm font-bold tracking-wide text-white/70">
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
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-4 pt-2 pb-2">
                          {(pd?.project_blurb || pd?.project_url) && (
                            <div className="flex flex-col gap-2.5">
                              {pd.project_blurb &&
                                pd.project_blurb.trim() !== "N/A" && (
                                  <p className="m-0 text-sm leading-normal text-white/75">
                                    {pd.project_blurb}
                                  </p>
                                )}
                              {pd?.project_url && (
                                <ProjectVisitLink href={pd.project_url} />
                              )}
                            </div>
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
                              const otherPartners = projPartners.filter(
                                (pn) => !isLeadInProj(pn),
                              );

                              const renderPartnerList = (
                                members: typeof projPartners,
                              ) => (
                                <div className="flex flex-wrap gap-1.5">
                                  {members.map((pn) => (
                                    <button
                                      key={pn.id}
                                      onClick={() => onPartnerClick(pn)}
                                      className="cursor-pointer rounded border border-white/12 bg-white/5 px-2 py-0.5 text-xs font-bold tracking-wide text-white/60 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
                                      onMouseEnter={(e) => {
                                        onOrgHover(pn.id);
                                        const pId = pn.partner?.airtable_id;
                                        const role =
                                          pId &&
                                          pd?.linked_lead_org?.includes(pId)
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
                                            x: rect.left + rect.width / 2,
                                            y: rect.top - 1,
                                          });
                                        }
                                      }}
                                      onMouseLeave={() => {
                                        onOrgHover(null);
                                        setPartnerTooltip(null);
                                      }}
                                    >
                                      {pn.partner?.org_short_name ?? pn.name}
                                    </button>
                                  ))}
                                </div>
                              );

                              return (
                                <div className="flex flex-col gap-2">
                                  {leadPartners.length > 0 && (
                                    <div>
                                      <p className="m-0 mb-0.5 text-xs font-bold tracking-widest text-white/35 uppercase">
                                        {leadPartners.length === 1
                                          ? "Project Lead"
                                          : "Project Leads"}
                                      </p>
                                      {renderPartnerList(leadPartners)}
                                    </div>
                                  )}
                                  {otherPartners.length > 0 && (
                                    <div>
                                      <p className="m-0 mb-0.5 text-xs font-bold tracking-widest text-white/35 uppercase">
                                        All Collaborating &amp; Implementing
                                        Partners
                                      </p>
                                      {renderPartnerList(otherPartners)}
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
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
