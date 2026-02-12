"use client";

import { useEffect, useState } from "react";

/**
 * Client-only wrapper to prevent hydration mismatches
 * Forces component to only render on client side
 */
export function ClientOnly({ children }: { children: React.ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null;
  }

  return <>{children}</>;
}
