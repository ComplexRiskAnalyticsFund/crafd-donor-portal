"use client";

import Image from "next/image";
import { useTab } from "./TabContext";
import { AIRTABLE_TABS } from "@/config/airtable";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Grid, BarChart3, Users, Building2, LayoutGrid, List, LogOut, Menu } from "lucide-react";

export function Header() {
  const { activeTab, setActiveTab, getTabLabel, activeView, setActiveView } = useTab();
  const tabLabel = getTabLabel(activeTab);

  // Find current tab data
  const currentTab = AIRTABLE_TABS.find((tab) => tab.value === activeTab);
  const hasMultipleViews = currentTab && "views" in currentTab && (currentTab as any).views;

  // Map icons to tabs
  const tabIcons: { [key: string]: React.ReactNode } = {
    projects: <Grid className="w-4 h-4" />,
    steerco: <BarChart3 className="w-4 h-4" />,
    contacts: <Users className="w-4 h-4" />,
    partners: <Building2 className="w-4 h-4" />,
  };

  // Map icons to views
  const viewIcons: { [key: string]: React.ReactNode } = {
    grid: <LayoutGrid className="w-4 h-4" />,
    list: <List className="w-4 h-4" />,
  };

  return (
    <header className="z-40 shrink-0 bg-black px-4 py-4 md:px-8 md:py-0">
      {/* Desktop Layout */}
      <div className="hidden lg:flex items-center justify-between gap-6">
        {/* Logo and Title */}
        <div className="flex items-center gap-6">
          {/* Logo */}
          <a
            href="https://crafd.io"
            target="_blank"
            rel="noopener noreferrer"
            className="relative h-[calc(2*1.875rem)] w-auto cursor-pointer transition-opacity hover:opacity-80"
          >
            <Image
              src="/images/crafd-logo-full-white.svg"
              alt="CRAF'd Logo"
              width={100}
              height={66}
              className="h-full w-auto object-contain"
            />
          </a>
          {/* Title and Subtitle */}
          <div className="flex flex-col gap-1">
            <h1 className="font-qanelas text-[2.1rem] leading-none font-extrabold tracking-tight text-white">
              CRAF'd Transparency Portal
            </h1>
            {tabLabel && (
              <p className="text-sm font-semibold text-crafd-yellow">
                {tabLabel}
              </p>
            )}
          </div>
        </div>
        {/* Middle Image */}
        <div className="flex-1 flex justify-center px-4">
          <Image
            src="/images/wide.png"
            alt="CRAF'd"
            width={300}
            height={60}
            className="h-auto w-auto object-contain"
          />
        </div>
        {/* Tab Buttons and View Selector on Right */}
        <div className="flex items-center gap-4">
          {/* View Selector for Project Data */}
          <Select value={activeView} onValueChange={setActiveView} disabled={!hasMultipleViews}>
            <SelectTrigger className={cn(
              "w-[140px] bg-black border-crafd-yellow text-white hover:bg-crafd-yellow/10",
              !hasMultipleViews && "invisible"
            )}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(currentTab as any).views && (currentTab as any).views.map((view: any) => (
                <SelectItem key={view.value} value={view.value}>
                  <div className="flex items-center gap-2">
                    {viewIcons[view.value]}
                    <span>{view.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Tab Buttons */}
          <nav className="flex gap-2">
            {AIRTABLE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded transition-all duration-200",
                  activeTab === tab.value
                    ? "bg-crafd-yellow text-black"
                    : "text-white hover:bg-crafd-yellow/20"
                )}
              >
                {tabIcons[tab.value as keyof typeof tabIcons]}
                {tab.label}
              </button>
            ))}
          </nav>
          {/* Logout Button */}
          <a
            href="/logout"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded transition-all duration-200 text-white bg-rose-700 hover:bg-rose-600"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </a>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="flex flex-col gap-4 lg:hidden">
        {/* Top Row: Logo and Logout */}
        <div className="flex items-center justify-between gap-4">
          <a
            href="https://crafd.io"
            target="_blank"
            rel="noopener noreferrer"
            className="relative h-12 w-auto cursor-pointer transition-opacity hover:opacity-80"
          >
            <Image
              src="/images/crafd-logo-full-white.svg"
              alt="CRAF'd Logo"
              width={80}
              height={53}
              className="h-full w-auto object-contain"
            />
          </a>
          <a
            href="/logout"
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded transition-all duration-200 text-white bg-rose-700 hover:bg-rose-600"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </a>
        </div>
        
        {/* Title */}
        <div className="flex flex-col gap-1">
          <h1 className="font-qanelas text-xl sm:text-2xl leading-tight font-extrabold tracking-tight text-white">
            CRAF'd Transparency Portal
          </h1>
          {tabLabel && (
            <p className="text-sm font-semibold text-crafd-yellow">
              {tabLabel}
            </p>
          )}
        </div>

        {/* Controls Row: Tab Selector and View Selector */}
        <div className="flex items-center gap-3">
          {/* Tab Selector (Mobile) */}
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="flex-1 bg-black border-crafd-yellow text-white hover:bg-crafd-yellow/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AIRTABLE_TABS.map((tab) => (
                <SelectItem key={tab.value} value={tab.value}>
                  <div className="flex items-center gap-2">
                    {tabIcons[tab.value as keyof typeof tabIcons]}
                    <span>{tab.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View Selector (Mobile) */}
          <Select value={activeView} onValueChange={setActiveView} disabled={!hasMultipleViews}>
            <SelectTrigger className={cn(
              "w-[140px] bg-black border-crafd-yellow text-white hover:bg-crafd-yellow/10",
              !hasMultipleViews && "invisible"
            )}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(currentTab as any).views && (currentTab as any).views.map((view: any) => (
                <SelectItem key={view.value} value={view.value}>
                  <div className="flex items-center gap-2">
                    {viewIcons[view.value]}
                    <span>{view.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </header>
  );
}
