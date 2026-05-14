"use client";
import Image from "next/image";
import { motion } from "framer-motion";
import type { HexNode } from "@/app/partners/lib/label";
import type { CrafdProject } from "@/types";
import { cn } from "@/lib/utils";
import { parseProjects, toLogoSlug, formatGrantSize } from "./lib/utils";
import { ProjectVisitLink } from "./lib/ProjectVisitLink";
import { useSheetDrag } from "./hooks/useSheetDrag";
import commitmentsData from "../../../public/data/commitments.json";

interface DonorPanelProps {
  clickedNode: HexNode;
  projectsById: Record<string, CrafdProject>;
  isMobile: boolean;
  sheetSnap: "half" | "full";
  setSheetSnap: (v: "half" | "full") => void;
  onClose: () => void;
}

export function DonorPanel({
  clickedNode,
  projectsById,
  isMobile,
  sheetSnap,
  setSheetSnap,
  onClose,
}: DonorPanelProps) {
  const { sheetStyle, isDragging, handleDragStart, handleDragMove, handleDragEnd } =
    useSheetDrag({ sheetSnap, setSheetSnap, onClose });

  const p = clickedNode.partner;
  const name = p?.org_short_name?.trim() ?? clickedNode.name ?? "Donor";
  const fullName = p?.org_full_name?.trim() ?? "";
  const logoSlug = toLogoSlug(name);

  const commitment = commitmentsData.find((c) => {
    const cn = c["Contributor/Partner"].toLowerCase();
    return (
      cn === name.toLowerCase() ||
      cn === fullName.toLowerCase() ||
      name.toLowerCase().includes(cn) ||
      cn.includes(name.toLowerCase())
    );
  });

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex">
      {isMobile && (
        <div
          className="pointer-events-auto absolute inset-0 bg-black/55"
          onClick={onClose}
        />
      )}

      <motion.div
        key={`donor-panel-${clickedNode.id}`}
        initial={isMobile ? { y: "100%" } : { x: "-100%" }}
        animate={isMobile ? { y: 0 } : { x: 0 }}
        exit={isMobile ? { y: "100%" } : { x: "-100%" }}
        transition={{ type: "tween", ease: "easeInOut", duration: 0.18 }}
        className={cn(
          "pointer-events-auto flex flex-col overflow-hidden text-white",
          isMobile ? "backdrop-blur-sm" : "backdrop-blur-md",
          isMobile
            ? "absolute inset-x-0 bottom-0 border-t border-white/10"
            : "h-full w-1/3 max-w-2xl min-w-80 border-r border-white/10",
          isMobile && sheetSnap === "full"
            ? "rounded-t-none"
            : isMobile
              ? "rounded-t-2xl"
              : "",
        )}
        style={{
          background: isMobile ? "rgba(8,8,8,0.96)" : "rgba(8,8,8,0.93)",
          ...(isMobile && sheetStyle),
        }}
        data-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        {isMobile && (
          <div
            className="flex shrink-0 cursor-grab touch-none justify-center pt-3 pb-1"
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
          >
            <div className="h-1 w-9 rounded-sm bg-white/30" />
          </div>
        )}

        {/* Header */}
        <div
          className={cn(
            "flex shrink-0 flex-col gap-3",
            isMobile ? "px-6 py-4" : "px-10 pt-10 pb-4",
          )}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              {/* Flag */}
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white shadow-md">
                <Image
                  src={`/logos/countries/${logoSlug}.svg`}
                  alt={name}
                  width={0}
                  height={0}
                  style={{ width: "72%", height: "72%", objectFit: "contain" }}
                />
              </div>

              {/* Title */}
              <div className="flex flex-col gap-0.5">
                <p className="m-0 text-xs font-bold tracking-widest text-white/50 uppercase">
                  Donor Partner
                </p>
                <h1
                  className={cn(
                    "m-0 leading-tight font-extrabold tracking-wide text-crafd-yellow uppercase",
                    isMobile ? "text-2xl" : "text-3xl",
                  )}
                >
                  {name}
                </h1>
                {fullName && fullName !== name && (
                  <p className="m-0 text-sm leading-snug text-white/65">
                    {fullName}
                  </p>
                )}
              </div>
            </div>

            {/* Close */}
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
          {/* Commitment card */}
          {(commitment ?? p?.total_grant_size) && (
            <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="m-0 text-xs font-bold tracking-widest text-white/50 uppercase">
                Total Commitment
              </p>
              <p className="m-0 text-4xl font-extrabold leading-none text-white">
                {formatGrantSize(
                  commitment?.Commitments ?? p!.total_grant_size!,
                )}
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
                className="flex flex-col gap-4 border-l-4 border-crafd-yellow pl-4"
              >
                <h3 className="m-0 text-base leading-tight font-extrabold text-white">
                  {pd.full_title ?? pd.project_label ?? proj}
                </h3>

                {pd.project_blurb && pd.project_blurb.trim() !== "N/A" && (
                  <p className="m-0 text-sm leading-normal text-white/75">
                    {pd.project_blurb}
                  </p>
                )}

                {pd.grant_size && (
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-white/8 px-2 py-0.5 text-sm font-bold tracking-wide text-white/85">
                      {formatGrantSize(pd.grant_size)}
                    </span>
                    {pd.duration_months && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-sm font-bold tracking-wide text-white/70">
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
