"use client";

import Image from "next/image";
import { useTab } from "./TabContext";

export function Header() {
  const { getTabLabel, activeTab } = useTab();
  const tabLabel = getTabLabel(activeTab);

  return (
    <header className="z-40 shrink-0 bg-black px-8 py-4">
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
    </header>
  );
}
