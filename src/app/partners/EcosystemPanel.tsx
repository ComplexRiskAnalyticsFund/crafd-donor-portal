"use client";
import { useRef } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import type { HexNode } from "@/lib/partners/label";
import type { CrafdProject } from "@/types";
import { cn } from "@/lib/utils";
import { parseProjects, formatGrantSize } from "./utils";

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
}

function ProjectVisitLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 self-start rounded-md bg-[#F1B434] px-4 py-2 text-[0.72rem] font-extrabold tracking-[0.08em] text-black uppercase no-underline transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        className="shrink-0"
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
}: EcosystemPanelProps) {
  const sheetTouchStartY = useRef(0);
  const projects = [...parseProjects(lockedFeature)];
  const partnerName =
    lockedSourceNode?.partner?.org_short_name?.trim() ??
    lockedSourceNode?.name ??
    "Partner";

  const logoSrc =
    lockedSourceNode?.partner?.white_logo_path ??
    lockedSourceNode?.partner?.color_logo_path;
  const logoNeedsFilter =
    !lockedSourceNode?.partner?.white_logo_path &&
    !!lockedSourceNode?.partner?.color_logo_path;

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
            "pointer-events-auto flex flex-col overflow-hidden text-white backdrop-blur-md",
            isMobile
              ? "absolute inset-x-0 bottom-0 border-t border-white/[0.12]"
              : "w-1/3 max-w-[700px] min-w-[360px] border-r border-white/[0.08]",
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
              "flex shrink-0 flex-col gap-4",
              isMobile ? "px-6 py-4" : "px-10 pt-10 pb-5",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-[0.85rem]">
                {logoSrc && (
                  <Image
                    src={logoSrc}
                    alt={partnerName}
                    width={100}
                    height={44}
                    className="shrink-0 object-contain"
                    style={{
                      height: isMobile ? 32 : 44,
                      width: "auto",
                      maxWidth: 100,
                      filter: logoNeedsFilter
                        ? "grayscale(100%) brightness(1.1)"
                        : undefined,
                    }}
                  />
                )}
                <div className="flex flex-col gap-1">
                  <h1
                    className="m-0 leading-[1.15] font-normal tracking-[0.03em] text-[#F1B434] uppercase"
                    style={{ fontSize: isMobile ? "1.2rem" : "1.6rem" }}
                  >
                    Ecosystem of{" "}
                    <span className="font-extrabold">{partnerName}</span>
                  </h1>
                  {lockedSourceNode?.partner?.org_type && (
                    <p className="m-0 text-[0.62rem] font-bold tracking-[0.12em] text-white/40 uppercase">
                      {lockedSourceNode.partner.org_type}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={onClose}
                className={cn(
                  "flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-transparent text-white",
                  isMobile
                    ? "h-10 w-10 text-[1.4rem]"
                    : "h-8 w-8 text-[1.1rem]",
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
              isMobile ? "px-6 pt-4 pb-6" : "px-10 pt-6 pb-10",
            )}
            data-modal="true"
          >
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
                  className="flex flex-col"
                >
                  <div className="border-l-[3px] border-[#F1B434] pl-[0.6rem]">
                    <button
                      onClick={toggleProj}
                      className="flex w-full cursor-pointer items-start justify-between gap-3 border-none bg-transparent pb-[0.45rem] text-left text-white"
                      style={{ padding: 0, paddingBottom: "0.45rem" }}
                    >
                      <h3 className="m-0 flex-1 text-[1.05rem] leading-[1.3] font-extrabold">
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
                            <span className="font-bold text-[#F1B434]">
                              {role}
                              <span className="mx-[0.4rem] opacity-40">|</span>
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
                        className="mt-[3px] shrink-0 opacity-60"
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
                          <span className="inline-flex items-center gap-[0.3rem] rounded-md border border-white/[0.18] bg-white/[0.08] px-[0.55rem] py-[0.2rem] text-[0.9rem] font-bold tracking-[0.04em] text-white/85">
                            {formatGrantSize(pd.grant_size)}
                          </span>
                        )}
                        {pd?.duration_months && (
                          <span className="inline-flex items-center gap-[0.3rem] rounded-md border border-white/[0.15] bg-white/[0.06] px-[0.55rem] py-[0.2rem] text-[0.9rem] font-bold tracking-[0.04em] text-white/70">
                            {pd.duration_months} months
                          </span>
                        )}
                        {pd?.project_coverage && (
                          <span className="inline-flex items-center gap-[0.3rem] rounded-md border border-white/[0.15] bg-white/[0.06] px-[0.55rem] py-[0.2rem] text-[0.9rem] font-bold tracking-[0.04em] text-white/70">
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
                        <div
                          className="flex flex-col gap-[0.6rem] pt-[0.6rem] pb-[0.25rem]"
                          style={{ paddingLeft: "calc(3px + 0.6rem)" }}
                        >
                          {pd?.project_blurb && (
                            <p className="m-0 text-[0.88rem] leading-[1.75] opacity-[0.78]">
                              {pd.project_blurb}
                            </p>
                          )}

                          {pd?.project_url && (
                            <ProjectVisitLink href={pd.project_url} />
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
                                <p className="m-0 text-[0.78rem] leading-[1.9]">
                                  {members.map((pn, pi) => (
                                    <span key={pn.id}>
                                      {pi > 0 && (
                                        <span className="mx-[0.25rem] text-white/25">
                                          ·
                                        </span>
                                      )}
                                      <button
                                        onClick={() => onPartnerClick(pn)}
                                        className="cursor-pointer border-none bg-transparent p-0 font-[inherit] text-[0.78rem] text-white/65 no-underline hover:text-white"
                                        onMouseEnter={(e) => {
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
                                        onMouseLeave={() =>
                                          setPartnerTooltip(null)
                                        }
                                      >
                                        {pn.partner?.org_short_name ?? pn.name}
                                      </button>
                                    </span>
                                  ))}
                                </p>
                              );

                              return (
                                <div className="flex flex-col gap-2">
                                  {leadPartners.length > 0 && (
                                    <div>
                                      <p className="m-0 mb-[0.2rem] text-[0.62rem] font-bold tracking-[0.1em] text-white/35 uppercase">
                                        Project Lead Partners
                                      </p>
                                      {renderPartnerList(leadPartners)}
                                    </div>
                                  )}
                                  {otherPartners.length > 0 && (
                                    <div>
                                      <p className="m-0 mb-[0.2rem] text-[0.62rem] font-bold tracking-[0.1em] text-white/35 uppercase">
                                        Collaborating &amp; Implementing
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
