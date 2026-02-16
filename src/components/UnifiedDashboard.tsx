"use client";

import { useEffect } from "react";
import { AIRTABLE_TABS } from "@/config/airtable";
import { useTab } from "./TabContext";
import { useAirtablePrefetch } from "@/lib/useAirtablePrefetch";

/**
 * Helper function to get all iframe URLs that need to be rendered
 */
function getAllIframeUrls(): Array<{
  id: string;
  url: string;
  label: string;
}> {
  const iframes: Array<{ id: string; url: string; label: string }> = [];

  AIRTABLE_TABS.forEach((tab) => {
    if ("views" in tab && (tab as any).views) {
      // Tab has multiple views
      (tab as any).views.forEach((view: any) => {
        if (view.iframeUrl) {
          iframes.push({
            id: `${tab.value}-${view.value}`,
            url: view.iframeUrl,
            label: `${tab.label} - ${view.label}`,
          });
        }
      });
    } else if ((tab as any).iframeUrl) {
      // Tab has single view
      iframes.push({
        id: tab.value,
        url: (tab as any).iframeUrl,
        label: tab.label,
      });
    }
  });

  return iframes;
}

export function UnifiedDashboard() {
  useAirtablePrefetch();
  const { activeTab, activeView } = useTab();

  const activeId = activeView ? `${activeTab}-${activeView}` : activeTab;
  const allIframes = getAllIframeUrls();

  useEffect(() => {
    // Sync URL with active tab
    window.history.pushState(null, "", `/?tab=${activeTab}`);
  }, [activeTab]);

  return (
    <div className="flex h-full flex-col">
      {/* Airtable Iframe Container */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {allIframes.map((iframe) => (
          <div
            key={iframe.id}
            className={`absolute inset-0 transition-opacity duration-200 ${
              activeId === iframe.id ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
          >
            <iframe
              src={iframe.url}
              className="h-full w-full border-none"
              title={iframe.label}
              allow="accelerometer; camera; microphone; gyroscope"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
