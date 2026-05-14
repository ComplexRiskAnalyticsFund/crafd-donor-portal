"use client";
import { useCallback, useRef, useState } from "react";

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

  const handleDragStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    dragging.current = true;
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

  /** Inline style to apply on the sheet's motion.div (mobile only). */
  const sheetStyle = {
    height: "100dvh" as const,
    transform: `translateY(calc(${sheetSnap === "full" ? "0%" : "50%"} + ${dragOffset}px))`,
    transition: dragging.current
      ? "none"
      : "transform 0.3s cubic-bezier(0.32,0.72,0,1)",
    willChange: dragging.current ? ("transform" as const) : ("auto" as const),
  };

  return {
    dragOffset,
    isDragging: dragging,
    sheetStyle,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
}
