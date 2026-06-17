"use client";
import { useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query without a setState-in-effect.
 * Returns `false` during SSR (server snapshot) and the live match on the client.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = (onChange: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  };
  const getSnapshot = () => window.matchMedia(query).matches;
  const getServerSnapshot = () => false;
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
