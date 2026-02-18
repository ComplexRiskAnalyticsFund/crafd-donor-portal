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

  if (NON_IFRAME_ROUTES.some((r) => pathname.startsWith(r))) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      {IFRAMES.filter((iframe) => iframe.src).map((iframe) => {
        const active = iframe.isActive(pathname, activeView);
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
            <iframe
              src={iframe.src}
              title={iframe.title}
              className="h-full w-full border-none"
              allow="accelerometer; gyroscope"
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
