"use client";
import { useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import type { HexNode } from "@/lib/partners/label";
import type { CrafdProject } from "@/types";
import { cn } from "@/lib/utils";
import { parseProjects, toLogoSlug, formatGrantSize } from "./utils";

interface DonorPanelProps {
  clickedNode: HexNode;
  projectsById: Record<string, CrafdProject>;
  isMobile: boolean;
  sheetSnap: "half" | "full";
  setSheetSnap: (v: "half" | "full") => void;
  onClose: () => void;
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

export function DonorPanel({
  clickedNode,
  projectsById,
  isMobile,
  sheetSnap,
  setSheetSnap,
  onClose,
}: DonorPanelProps) {
  const sheetTouchStartY = useRef(0);
  const p = clickedNode.partner;
  const name = p?.org_short_name?.trim() ?? clickedNode.name ?? "Donor";
  const fullName = p?.org_full_name?.trim() ?? "";
  const logoSlug = toLogoSlug(name);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex">
      <div
        className="pointer-events-auto absolute inset-0 bg-black/55"
        onClick={onClose}
      />

      <motion.div
        key={`donor-panel-${clickedNode.id}`}
        initial={isMobile ? { y: "100%" } : { x: "-100%" }}
        animate={isMobile ? { y: 0 } : { x: 0 }}
        exit={isMobile ? { y: "100%" } : { x: "-100%" }}
        transition={{ type: "tween", ease: "easeInOut", duration: 0.18 }}
        className={cn(
          "pointer-events-auto relative z-[1] flex flex-col overflow-hidden text-white backdrop-blur-md",
          isMobile
            ? "absolute inset-x-0 bottom-0 border-t border-white/[0.12]"
            : "h-full w-1/3 max-w-[700px] min-w-[360px] border-r border-white/[0.08]",
          isMobile && sheetSnap === "full"
            ? "rounded-t-none"
            : isMobile
              ? "rounded-t-2xl"
              : "",
        )}
        style={{
          background: "rgba(8,8,8,0.96)",
          ...(isMobile && {
            height: sheetSnap === "full" ? "100dvh" : "50dvh",
            transition: "height 0.3s ease",
          }),
        }}
        data-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        {isMobile && (
          <div
            className="flex shrink-0 cursor-grab touch-none justify-center pt-3 pb-1"
            onTouchStart={(e) => {
              sheetTouchStartY.current = e.touches[0].clientY;
            }}
            onTouchEnd={(e) => {
              const dy = e.changedTouches[0].clientY - sheetTouchStartY.current;
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

        {/* Header */}
        <div
          className={cn(
            "flex shrink-0 flex-col gap-4",
            isMobile ? "px-6 py-4" : "px-10 pt-10 pb-5",
          )}
        >
          <div className="flex items-start gap-4">
            {/* Flag */}
            <div className="justify-content-center flex h-14 w-14 shrink-0 items-center overflow-hidden rounded-lg border border-black/[0.12] bg-white">
              <Image
                src={`/logos/countries/${logoSlug}.svg`}
                alt={name}
                width={0}
                height={0}
                style={{ width: "80%", height: "80%", objectFit: "contain" }}
              />
            </div>

            {/* Title */}
            <div className="min-w-0 flex-1">
              <p className="m-0 mb-[0.3rem] text-[0.65rem] tracking-[0.12em] text-[#F1B434] uppercase">
                Donor Partner
              </p>
              <h1 className="m-0 text-[1.1rem] leading-[1.2] font-extrabold tracking-[0.02em] text-white uppercase">
                {name}
              </h1>
              {fullName && fullName !== name && (
                <p className="m-0 mt-1 text-[0.78rem] leading-[1.4] text-white/55">
                  {fullName}
                </p>
              )}
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className={cn(
                "flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-transparent text-white",
                isMobile ? "h-10 w-10 text-[1.4rem]" : "h-8 w-8 text-[1.1rem]",
              )}
            >
              ×
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div
          className={cn(
            "flex flex-1 flex-col gap-7 overflow-y-auto",
            isMobile ? "px-6 pb-6" : "px-10 pb-10",
          )}
          data-modal="true"
        >
          {/* Total contribution */}
          {p?.total_grant_size && (
            <div className="flex flex-col gap-[0.4rem]">
              <p className="m-0 text-[0.65rem] tracking-[0.12em] text-white/50 uppercase">
                Total Contribution to CRAF&apos;d
              </p>
              <p className="m-0 text-[2.8rem] leading-none font-extrabold text-white">
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
                className="flex flex-col gap-4 border-t border-white/[0.08] pt-5"
              >
                <h3 className="m-0 text-[1.05rem] font-extrabold text-white">
                  {pd.full_title ?? pd.project_label ?? proj}
                </h3>

                {pd.project_blurb && pd.project_blurb.trim() !== "N/A" && (
                  <p className="m-0 text-[0.9rem] leading-[1.75] text-white/[0.72]">
                    {pd.project_blurb}
                  </p>
                )}

                {pd.grant_size && (
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-md border border-[rgba(241,180,52,0.35)] bg-[rgba(241,180,52,0.12)] px-[0.55rem] py-[0.2rem] text-[0.9rem] font-bold text-[#F1B434]">
                      {formatGrantSize(pd.grant_size)}
                    </span>
                    {pd.duration_months && (
                      <span className="inline-flex items-center rounded-md border border-white/[0.15] bg-white/[0.06] px-[0.55rem] py-[0.2rem] text-[0.9rem] font-bold text-white/70">
                        {pd.duration_months} months
                      </span>
                    )}
                  </div>
                )}

                {pd.project_url && <ProjectVisitLink href={pd.project_url} />}
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
