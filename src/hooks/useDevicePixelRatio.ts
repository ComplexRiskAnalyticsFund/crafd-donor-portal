"use client";
import { useSyncExternalStore } from "react";

/**
 * Subscribe to the window's devicePixelRatio without a setState-in-effect.
 *
 * On Windows the device pixel ratio mirrors the OS "UI scaling" setting
 * (100% → 1, 125% → 1.25, 150% → 1.5, …) as well as browser zoom. Counter
 * scaling an element by 1/dpr therefore renders it at its 100%-scaling size.
 *
 * Returns `1` during SSR so the markup is stable, then the live ratio on the
 * client (re-subscribing whenever the ratio changes, e.g. moving the window to
 * a differently-scaled monitor or zooming the browser).
 */
export function useDevicePixelRatio(): number {
  const subscribe = (onChange: () => void) => {
    let mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const handler = () => {
      onChange();
      // Re-arm the listener against the new ratio so future changes still fire.
      mq.removeEventListener("change", handler);
      mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      mq.addEventListener("change", handler);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  };
  const getSnapshot = () => window.devicePixelRatio || 1;
  const getServerSnapshot = () => 1;
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
