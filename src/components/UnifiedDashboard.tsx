"use client";

import { useEffect } from "react";
import { AIRTABLE_TABS } from "@/config/airtable";
import { useTab } from "./TabContext";
import { cn } from "@/lib/utils";

export function UnifiedDashboard() {
  const { activeTab, setActiveTab } = useTab();

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

      {/* Tab Navigation at Bottom */}
      <nav className="shrink-0 bg-black">
        <div className="flex px-8">
          {AIRTABLE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "relative flex items-center px-8 py-5 text-base font-semibold transition-all duration-200",
                activeTab === tab.value
                  ? "bg-crafd-yellow text-black"
                  : "text-white hover:bg-crafd-yellow/20"
              )}
            >
              {tab.label}
              {activeTab === tab.value && (
                <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-crafd-yellow" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
