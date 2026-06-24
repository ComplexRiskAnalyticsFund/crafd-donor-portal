"use client";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { clampPan, HEX_SIZE, MIN_SCALE, MAX_SCALE } from "../lib/utils";
import type { HexNode } from "../lib/label";

export function usePanZoom({
  svgRef,
  closeAll,
}: {
  svgRef: React.RefObject<SVGSVGElement | null>;
  closeAll: () => void;
}) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(0.85);
  const panRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(0.85);
  const panGroupRef = useRef<SVGGElement>(null);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Bypasses React state for in-flight touch/pinch frames to avoid jitter
  function applyTransform(x: number, y: number, s: number) {
    panRef.current = { x, y };
    scaleRef.current = s;
    panGroupRef.current?.setAttribute(
      "transform",
      `translate(${x},${y}) scale(${s})`,
    );
  }

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

  // Wheel: Ctrl+scroll = zoom, plain scroll = pan
  // Attached to window so it works even when the modal overlay is present
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
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
  }, [svgRef]);

  // Keyboard: arrows pan, +/- zoom, R reset, Escape dismisses modal
  useEffect(() => {
    const PAN_STEP = 50;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") {
        closeAll();
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
  }, [closeAll]);

  const handleDoubleClick = () => {
    setPan({ x: 0, y: 0 });
    setScale(1);
  };

  const svgTouchHandlers = {
    onTouchStart(e: React.TouchEvent<SVGSVGElement>) {
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
        pinchStartRef.current = {
          dist: Math.sqrt(dx * dx + dy * dy),
          scale: scaleRef.current,
          midX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          midY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
        touchStartRef.current = null;
      }
    },
    onTouchMove(e: React.TouchEvent<SVGSVGElement>) {
      if ((e.target as Element)?.closest?.("[data-modal]")) return;
      e.preventDefault();
      const el = svgRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (e.touches.length === 1 && touchStartRef.current) {
        const dx = e.touches[0].clientX - touchStartRef.current.x;
        const dy = e.touches[0].clientY - touchStartRef.current.y;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) touchMovedRef.current = true;
        const px2unit = 1800 / rect.width;
        const { x, y } = clampPan(
          touchStartRef.current.panX + dx * px2unit,
          touchStartRef.current.panY + dy * px2unit,
          scaleRef.current,
        );
        applyTransform(x, y, scaleRef.current);
      } else if (e.touches.length === 2 && pinchStartRef.current) {
        touchMovedRef.current = true;
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const newScale = Math.min(
          MAX_SCALE,
          Math.max(
            MIN_SCALE,
            pinchStartRef.current.scale * (dist / pinchStartRef.current.dist),
          ),
        );
        const midSvgX =
          ((pinchStartRef.current.midX - rect.left) / rect.width) * 1800 - 900;
        const midSvgY =
          ((pinchStartRef.current.midY - rect.top) / rect.height) * 1000 - 500;
        const cx = (midSvgX - panRef.current.x) / scaleRef.current;
        const cy = (midSvgY - panRef.current.y) / scaleRef.current;
        const { x, y } = clampPan(
          midSvgX - cx * newScale,
          midSvgY - cy * newScale,
          newScale,
        );
        applyTransform(x, y, newScale);
      }
    },
    onTouchEnd() {
      touchStartRef.current = null;
      pinchStartRef.current = null;
      // Only commit to React state if the user actually panned/zoomed,
      // avoids an unnecessary full re-render on simple taps
      if (touchMovedRef.current) {
        setPan({ ...panRef.current });
        setScale(scaleRef.current);
      }
    },
  };

  const flyTlRef = useRef<gsap.core.Timeline | null>(null);
  const savedViewRef = useRef<{ x: number; y: number; s: number } | null>(null);

  function animateTo(
    targetX: number,
    targetY: number,
    targetS: number,
    groupEl: SVGGElement,
    onDone?: () => void,
  ) {
    flyTlRef.current?.kill();
    const proxy = {
      tx: panRef.current.x,
      ty: panRef.current.y,
      s: scaleRef.current,
    };
    flyTlRef.current = gsap.timeline({
      onComplete: () => {
        setPan({ x: targetX, y: targetY });
        setScale(targetS);
        flyTlRef.current = null;
        onDone?.();
      },
    });
    flyTlRef.current.to(proxy, {
      tx: targetX,
      ty: targetY,
      s: targetS,
      duration: 0.7,
      ease: "power3.inOut",
      onUpdate() {
        panRef.current = { x: proxy.tx, y: proxy.ty };
        scaleRef.current = proxy.s;
        groupEl.setAttribute(
          "transform",
          `translate(${proxy.tx},${proxy.ty}) scale(${proxy.s})`,
        );
      },
    });
  }

  // Animate pan+scale to frame the given nodes in the visible area.
  // vizBiasXPx: how many CSS pixels the content has been shifted right (= panelWidth/2).
  // With vizBiasX applied, SVG user-space (0,0) sits at the center of the right visible area,
  // so we just need to translate the bbox center to (0,0).
  const flyToNodes = useCallback(
    (nodes: HexNode[], vizBiasXPx = 0) => {
      if (!nodes.length) return;
      const svgEl = svgRef.current;
      const groupEl = panGroupRef.current;
      if (!svgEl || !groupEl) return;

      // Save current view so flyBack can restore it
      savedViewRef.current = {
        x: panRef.current.x,
        y: panRef.current.y,
        s: scaleRef.current,
      };

      const pad = HEX_SIZE * 2;
      const xs = nodes.map((n) => n.x);
      const ys = nodes.map((n) => n.y);
      const minX = Math.min(...xs) - pad;
      const maxX = Math.max(...xs) + pad;
      const minY = Math.min(...ys) - pad;
      const maxY = Math.max(...ys) + pad;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const bboxW = maxX - minX;
      const bboxH = maxY - minY;

      // Convert available screen area → SVG user units
      const screenW = svgEl.clientWidth || window.innerWidth;
      const screenH = svgEl.clientHeight || window.innerHeight;
      const panelPx = vizBiasXPx * 2;
      const availWpx = Math.max(screenW - panelPx, screenW * 0.5) * 0.88;
      const availHpx = screenH * 0.88;
      const pxPerUnit = screenW / 1800;
      const availW = availWpx / pxPerUnit;
      const availH = availHpx / (screenH / 1000);

      const newScale = Math.min(availW / bboxW, availH / bboxH, MAX_SCALE);
      const clampedScale = Math.max(MIN_SCALE, newScale);
      const { x: newX, y: newY } = clampPan(
        -cx * clampedScale,
        -cy * clampedScale,
        clampedScale,
      );

      animateTo(newX, newY, clampedScale, groupEl);
    },
     
    [svgRef],
  );

  const flyBack = useCallback(() => {
    const saved = savedViewRef.current;
    const groupEl = panGroupRef.current;
    if (!saved || !groupEl) return;
    savedViewRef.current = null;
    animateTo(saved.x, saved.y, saved.s, groupEl);
     
  }, []);

  return {
    pan,
    scale,
    panGroupRef,
    handleDoubleClick,
    svgTouchHandlers,
    touchMovedRef,
    flyToNodes,
    flyBack,
  };
}
