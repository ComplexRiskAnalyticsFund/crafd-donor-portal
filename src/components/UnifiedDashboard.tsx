"use client";

import { useEffect } from "react";
import { AIRTABLE_TABS } from "@/config/airtable";
import { useTab } from "./TabContext";
import { useAirtablePrefetch } from "@/lib/useAirtablePrefetch";

export function UnifiedDashboard() {
  useAirtablePrefetch();
  const { activeTab, activeView } = useTab();

  const activeTabData = AIRTABLE_TABS.find((tab) => tab.value === activeTab);
  
  // Determine the iframe URL based on whether tab has multiple views
  let iframeUrl = "";
  if (activeTabData) {
    if ("views" in activeTabData && (activeTabData as any).views) {
      // Tab has multiple views
      const view = (activeTabData as any).views.find(
        (v: any) => v.value === activeView
      );
      iframeUrl = view?.iframeUrl || "";
    } else {
      // Tab has single view
      iframeUrl = (activeTabData as any).iframeUrl || "";
    }
  }

  useEffect(() => {
    // Sync URL with active tab
    window.history.pushState(null, "", `/?tab=${activeTab}`);
  }, [activeTab]);

  return (
    <div className="flex h-full flex-col">
      {/* Airtable Iframe Container */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {iframeUrl && (
          <iframe
            key={`${activeTab}-${activeView}`}
            src={iframeUrl}
            className="h-full w-full border-none"
            title={activeTabData?.label}
            allow="accelerometer; camera; microphone; gyroscope"
          />
        )}
      </div>
    </div>
  );
}
