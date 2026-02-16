/**
 * Airtable iframe prefetch utilities
 * Prefetches all configured Airtable iframes in the background to improve load times
 */

import { AIRTABLE_TABS } from "@/config/airtable";

/**
 * Extracts all unique iframe URLs from the Airtable configuration
 */
export function getAllAirtableUrls(): string[] {
  const urls = new Set<string>();

  AIRTABLE_TABS.forEach((tab) => {
    if ("views" in tab && tab.views) {
      // Tab has multiple views
      tab.views.forEach((view) => {
        if (view.iframeUrl) {
          urls.add(view.iframeUrl);
        }
      });
    } else if ("iframeUrl" in tab && tab.iframeUrl) {
      // Tab has single view
      urls.add(tab.iframeUrl);
    }
  });

  return Array.from(urls).filter((url) => url.length > 0);
}

/**
 * Prefetches Airtable iframes by creating hidden iframes
 * This allows the browser to cache the iframes in the background
 * without blocking the UI
 */
export function prefetchAirtableIframes(): void {
  if (typeof window === "undefined") {
    return;
  }

  // Use requestIdleCallback if available for non-blocking prefetch
  const prefetchFn = () => {
    const urls = getAllAirtableUrls();

    urls.forEach((url) => {
      try {
        // Create a hidden iframe for each URL
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "none";
        iframe.src = url;
        iframe.setAttribute("aria-hidden", "true");
        iframe.setAttribute("tabindex", "-1");

        // Add to DOM to trigger loading
        document.body.appendChild(iframe);

        // Remove after it starts loading (after a brief delay)
        // Keep it attached for a moment to ensure the fetch starts
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch (e) {
            // Iframe might already be removed
          }
        }, 1000);
      } catch (error) {
        console.warn(`Failed to prefetch Airtable iframe: ${url}`, error);
      }
    });
  };

  // Use requestIdleCallback for non-blocking prefetch
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(prefetchFn, { timeout: 2000 });
  } else {
    // Fallback to setTimeout
    setTimeout(prefetchFn, 500);
  }
}
