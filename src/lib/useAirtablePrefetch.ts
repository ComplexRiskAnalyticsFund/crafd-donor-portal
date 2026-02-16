/**
 * Hook to prefetch Airtable iframes on component mount
 */

import { useEffect } from "react";
import { prefetchAirtableIframes } from "./airtable-prefetch";

/**
 * Custom hook that prefetches all Airtable iframes when the component mounts
 * This improves perceived performance by loading iframes in the background
 */
export function useAirtablePrefetch(): void {
  useEffect(() => {
    prefetchAirtableIframes();
  }, []);
}
