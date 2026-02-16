"use client";

import { useEffect } from "react";
import { AIRTABLE_TABS } from "@/config/airtable";
import { useTab } from "./TabContext";

export function UnifiedDashboard() {
  const { activeTab } = useTab();

  const activeTabData = AIRTABLE_TABS.find((tab) => tab.value === activeTab);

  useEffect(() => {
    // Sync URL with active tab
    window.history.pushState(null, "", `/?tab=${activeTab}`);
  }, [activeTab]);

  return (
    <div className="flex h-full flex-col">
      {/* Airtable Iframe Container */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTabData && (
          <iframe
            key={activeTab}
            src={activeTabData.iframeUrl}
            className="h-full w-full border-none"
            title={activeTabData.label}
            allow="accelerometer; camera; microphone; gyroscope"
          />
        )}
      </div>
    </div>
  );
}
