"use client";

/**
 * IframeLayer — renders ALL Airtable iframes and keeps them alive in the DOM forever.
 *
 * All iframes are rendered with their src on first mount and NEVER unmounted.
 * Visibility is toggled via CSS only (visibility + pointer-events), which
 * preserves the loaded state — no reloads on tab switch, ever.
 *
 * The active iframe is given `fetchPriority="high"` so the browser loads it
 * first; background iframes default to low priority.
 */

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTab } from "./TabContext";
import { AIRTABLE_TABS } from "@/config/airtable";

interface IframeConfig {
  key: string;
  src: string;
  title: string;
  isActive: (pathname: string, activeView: string) => boolean;
}

/** Derive flat iframe list from the shared config — single source of truth */
const IFRAMES: IframeConfig[] = AIRTABLE_TABS.flatMap((tab) => {
  if ("views" in tab && tab.views) {
    // Multi-view tab (e.g. projects with grid/list)
    return tab.views.map((view) => ({
      key: `${tab.value}-${view.value}`,
      src: view.iframeUrl,
      title: `${tab.label} – ${view.label}`,
      isActive: (p: string, v: string) =>
        (p === "/data" || p === "/data/") && v === view.value,
    }));
  }
  // Single-view tab
  return [
    {
      key: tab.value,
      src: (tab as { iframeUrl: string }).iframeUrl,
      title: tab.label,
      isActive: (p: string) => p.startsWith(`/data/${tab.value}`),
    },
  ];
});

/** Routes that render their own content without an iframe */
const NON_IFRAME_ROUTES = ["/steerco"];

export function IframeLayer() {
  const pathname = usePathname();
  const { activeView } = useTab();
  const [loadedIframes, setLoadedIframes] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Map<string, number>>(new Map());

  // Animate progress bar while loading
  useEffect(() => {
    const currentKey = IFRAMES.find((iframe) =>
      iframe.isActive(pathname, activeView),
    )?.key;

    if (!currentKey || loadedIframes.has(currentKey)) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const map = new Map(prev);
        const current = map.get(currentKey) || 0;
        // Slow down as we approach 90%, never reach 100% until onLoad
        const increment = current > 80 ? 2 : current > 50 ? 5 : 10;
        map.set(currentKey, Math.min(current + increment, 90));
        return map;
      });
    }, 300);

    return () => clearInterval(interval);
  }, [pathname, activeView, loadedIframes]);

  const handleIframeLoad = (key: string) => {
    // Complete the progress bar and mark as loaded
    setProgress((prev) => {
      const map = new Map(prev);
      map.set(key, 100);
      return map;
    });
    setLoadedIframes((prev) => new Set(prev).add(key));
  };

  if (NON_IFRAME_ROUTES.some((r) => pathname.startsWith(r))) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      {IFRAMES.filter((iframe) => iframe.src).map((iframe) => {
        const active = iframe.isActive(pathname, activeView);
        const isLoaded = loadedIframes.has(iframe.key);
        const currentProgress = progress.get(iframe.key) || 0;

        return (
          <div
            key={iframe.key}
            className="absolute inset-0"
            style={{
              visibility: active ? "visible" : "hidden",
              pointerEvents: active ? "auto" : "none",
            }}
            aria-hidden={!active}
          >
            {/* Progress bar — show while iframe is loading */}
            {active && !isLoaded && (
              <div className="pointer-events-auto absolute inset-x-0 top-0">
                <div className="h-1 w-full bg-gray-200">
                  <div
                    className="h-full bg-crafd-yellow transition-all duration-300 ease-out"
                    style={{ width: `${currentProgress}%` }}
                  />
                </div>
              </div>
            )}
            {/* Iframe */}
            <iframe
              src={iframe.src}
              title={iframe.title}
              className="h-full w-full border-none"
              allow="accelerometer; gyroscope"
              onLoad={() => handleIframeLoad(iframe.key)}
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-expect-error fetchPriority is a valid HTML attribute but missing from React's iframe typings
              fetchPriority={active ? "high" : "low"}
            />
          </div>
        );
      })}
    </div>
  );
}
