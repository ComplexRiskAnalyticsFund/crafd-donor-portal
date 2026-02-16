"use client";

import Image from "next/image";
import { useTab } from "./TabContext";
import { AIRTABLE_TABS } from "@/config/airtable";
import { cn } from "@/lib/utils";

export function Header() {
  const { activeTab, setActiveTab, getTabLabel } = useTab();
  const tabLabel = getTabLabel(activeTab);

  return (
    <header className="z-40 shrink-0 bg-black px-8 py-4">
      <div className="flex items-center justify-between gap-6">
        {/* Logo and Title */}
        <div className="flex items-center gap-6">
          {/* Logo */}
          <div className="relative h-[calc(2*1.875rem)] w-auto">
            <Image
              src="/images/crafd-logo-full-white.svg"
              alt="CRAF'd Logo"
              width={100}
              height={66}
              className="h-full w-auto object-contain"
            />
          </div>
          {/* Title and Subtitle */}
          <div className="flex flex-col gap-1">
            <h1 className="font-qanelas text-[2.1rem] leading-none font-extrabold tracking-tight text-white">
              Open CRAF'd Gateway
            </h1>
            {tabLabel && (
              <p className="text-sm font-semibold text-crafd-yellow">
                {tabLabel}
              </p>
            )}
          </div>
        </div>
        {/* Tab Buttons on Right */}
        <nav className="flex gap-2">
          {AIRTABLE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "px-4 py-2 text-sm font-semibold rounded transition-all duration-200",
                activeTab === tab.value
                  ? "bg-crafd-yellow text-black"
                  : "text-white hover:bg-crafd-yellow/20"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
