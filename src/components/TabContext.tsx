"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { AIRTABLE_TABS } from "@/config/airtable";

interface TabContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  getTabLabel: (tab: string) => string;
  activeView: string;
  setActiveView: (view: string) => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export function TabProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState(AIRTABLE_TABS[0].value);
  const [activeView, setActiveView] = useState("grid");

  const getTabLabel = (tab: string) => {
    return AIRTABLE_TABS.find((t) => t.value === tab)?.label ?? "";
  };

  return (
    <TabContext.Provider value={{ activeTab, setActiveTab, getTabLabel, activeView, setActiveView }}>
      {children}
    </TabContext.Provider>
  );
}

export function useTab() {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error("useTab must be used within TabProvider");
  }
  return context;
}
