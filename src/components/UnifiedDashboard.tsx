"use client";

import { AIRTABLE_TABS } from "@/config/airtable";
import { useTab } from "./TabContext";
import { useAirtablePrefetch } from "@/lib/useAirtablePrefetch";

export function UnifiedDashboard() {
  useAirtablePrefetch();
  const { activeView } = useTab();

  // Get project data (first tab with views)
  const projectData = AIRTABLE_TABS.find((tab) => tab.value === "projects");
  
  // Determine the iframe URL based on active view
  let iframeUrl = "";
  if (projectData && "views" in projectData && (projectData as any).views) {
    const view = (projectData as any).views.find(
      (v: any) => v.value === activeView
    );
    iframeUrl = view?.iframeUrl || "";
  }

  return (
    <div className="flex h-full flex-col">
      {/* Airtable Iframe Container */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {iframeUrl && (
          <iframe
            key={`projects-${activeView}`}
            src={iframeUrl}
            className="h-full w-full border-none"
            title="Project Data"
            allow="accelerometer; camera; microphone; gyroscope"
          />
        )}
      </div>
    </div>
  );
}
