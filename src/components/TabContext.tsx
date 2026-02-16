"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface TabContextType {
  activeView: string;
  setActiveView: (view: string) => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export function TabProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState("grid");

  return (
    <TabContext.Provider value={{ activeView, setActiveView }}>
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
