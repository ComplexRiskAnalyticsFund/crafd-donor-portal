"use client";

import { useSyncExternalStore } from "react";

// No-op subscribe: mount state never changes after hydration.
const emptySubscribe = () => () => {};

/**
 * Client-only wrapper to prevent hydration mismatches.
 * Renders nothing during SSR / first hydration pass, then renders children.
 * Uses useSyncExternalStore so the server snapshot (false) and client snapshot
 * (true) differ without a setState-in-effect.
 */
export function ClientOnly({ children }: { children: React.ReactNode }) {
  const hasMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!hasMounted) {
    return null;
  }

  return <>{children}</>;
}
