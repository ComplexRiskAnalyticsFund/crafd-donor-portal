"use client";
import { useSyncExternalStore } from "react";

/**
 * Whether the page is rendered inside an iframe. Uses `useSyncExternalStore`
 * (not a setState-in-effect) so there is no cascading render. Returns `true`
 * during SSR / initial hydration to match the embedded-by-default assumption,
 * then settles to the live value on the client.
 */
export function useIsEmbedded(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => window.self !== window.top,
    () => true,
  );
}
