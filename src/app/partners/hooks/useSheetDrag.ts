"use client";
import { useCallback, useRef, useState } from "react";
import type { Transition } from "framer-motion";

export function useSheetDrag({
  sheetSnap,
  setSheetSnap,
  onClose,
}: {
  sheetSnap: "half" | "full";
  setSheetSnap: (v: "half" | "full") => void;
  onClose: () => void;
}) {
  const touchStartY = useRef(0);
  const dragging = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);
  // Mirror of `dragging.current` that's safe to read during render (the ref
  // alone can't drive the transition without an exhaustive-deps / refs lint error).
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    dragging.current = true;
    setIsDragging(true);
    setDragOffset(0);
  }, []);

  const handleDragMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current) return;
    setDragOffset(e.touches[0].clientY - touchStartY.current);
  }, []);

  const handleDragEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      setIsDragging(false);
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      setDragOffset(0);
      if (dy < -40) setSheetSnap("full");
      else if (dy > 40) {
        if (sheetSnap === "full") setSheetSnap("half");
        else onClose();
      }
    },
    [sheetSnap, setSheetSnap, onClose],
  );

  // Framer-motion animate target — includes snap position + live drag offset.
  // During drag, framer-motion uses duration:0 for instant tracking.
  const snapY = sheetSnap === "full" ? "0%" : "50%";
  const motionAnimate = dragOffset
    ? { y: `calc(${snapY} + ${dragOffset}px)` }
    : { y: snapY };
  const motionTransition: Transition = isDragging
    ? { duration: 0 }
    : { type: "tween", ease: [0.32, 0.72, 0, 1] as [number, number, number, number], duration: 0.3 };

  return {
    dragOffset,
    isDragging,
    motionAnimate,
    motionTransition,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
}
