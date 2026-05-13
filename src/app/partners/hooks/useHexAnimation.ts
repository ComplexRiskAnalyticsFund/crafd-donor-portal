"use client";
import type React from "react";
import { useLayoutEffect, useRef } from "react";
import type { HexNode } from "@/app/partners/lib/label";
import gsap from "gsap";

export function useHexAnimation({
  renderNodes,
  svgRef,
  isMobileRef,
}: {
  renderNodes: HexNode[];
  svgRef: React.RefObject<SVGSVGElement | null>;
  isMobileRef: React.RefObject<boolean>;
}) {
  const animTlRef = useRef<gsap.core.Timeline | null>(null);

  // useLayoutEffect: runs synchronously after DOM update but before browser paint,
  // so gsap.set(opacity:0) hides nodes before they're ever visible — no flash.
  useLayoutEffect(() => {
    if (renderNodes.length === 0) return;
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const partnerGs = Array.from(
      svgEl.querySelectorAll<SVGGElement>('[data-kind="partner"]'),
    );
    if (partnerGs.length === 0) return;

    partnerGs.forEach((el) => gsap.set(el, { opacity: 0 }));

    // Mobile: simple fade-in to avoid the heavy staggered scale on low-end GPUs
    if (isMobileRef.current) {
      const id = requestAnimationFrame(() => {
        const tl = gsap.timeline({
          onComplete: () => {
            animTlRef.current = null;
          },
        });
        animTlRef.current = tl;
        tl.to(partnerGs, {
          opacity: 1,
          duration: 0.4,
          stagger: 0.003,
          ease: "power1.out",
        });
      });
      return () => {
        cancelAnimationFrame(id);
        animTlRef.current?.kill();
        animTlRef.current = null;
      };
    }

    // Desktop: radial group-wave with scale pop — Donor → UN/Project → Collab
    partnerGs.forEach((el) => {
      const cx = el.getAttribute("data-cx") ?? "0";
      const cy = el.getAttribute("data-cy") ?? "0";
      gsap.set(el, { scale: 0, svgOrigin: `${cx} ${cy}` });
    });

    const id = requestAnimationFrame(() => {
      const GROUP_WAVE = 0.5;
      const RADIAL_SPREAD = 0.6;
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
    });

    return () => {
      cancelAnimationFrame(id);
      animTlRef.current?.kill();
      animTlRef.current = null;
    };
  }, [renderNodes.length, svgRef, isMobileRef]);
}
