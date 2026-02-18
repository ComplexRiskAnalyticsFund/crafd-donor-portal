"use client";

import { Select, SelectItem, SelectValue } from "@/components/ui/select";
import {
  HeaderSelectTrigger,
  HeaderSelectContent,
} from "@/components/HeaderSelect";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Building2,
  Grid,
  LayoutGrid,
  List,
  LogOut,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTab } from "./TabContext";

const NAVIGATION_ITEMS = [
  {
    value: "data",
    label: "Project Data",
    shortLabel: "Projects",
    href: "/data",
    icon: Grid,
    exact: true,
  },
  {
    value: "steerco-data",
    label: "SteerCo Decisions",
    shortLabel: "Decisions",
    href: "/data/steerco",
    icon: BarChart3,
    exact: false,
  },
  {
    value: "contacts",
    label: "Contacts",
    shortLabel: "Contacts",
    href: "/data/contacts",
    icon: Users,
    exact: false,
  },
  {
    value: "partners",
    label: "Partner Organizations",
    shortLabel: "Partners",
    href: "/data/partners",
    icon: Building2,
    exact: false,
  },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeView, setActiveView } = useTab();

  // Find current navigation item based on pathname
  const currentNav = NAVIGATION_ITEMS.find((item) => {
    if (item.exact) {
      return pathname === item.href || pathname === item.href + "/";
    }
    return pathname.startsWith(item.href);
  });

  // Only show view selector on /data route for projects
  const showViewSelector = pathname === "/data" || pathname === "/data/";

  // Map icons to views
  const viewIcons: { [key: string]: React.ReactNode } = {
    grid: <LayoutGrid className="h-4 w-4" />,
    list: <List className="h-4 w-4" />,
  };

  const views = [
    { value: "grid", label: "Grid View" },
    { value: "list", label: "List View" },
  ];

  const handleNavChange = (value: string) => {
    const navItem = NAVIGATION_ITEMS.find((item) => item.value === value);
    if (navItem) {
      router.push(navItem.href);
    }
  };

  return (
    <header className="z-40 shrink-0 bg-black px-4 py-2 md:px-8 md:py-0">
      {/* Desktop Layout */}
      <div className="hidden items-center justify-between gap-6 lg:flex lg:h-20">
        {/* Logo and Title */}
        <div className="flex items-center gap-4">
          {/* Logo */}
          <a
            href="https://crafd.io"
            target="_blank"
            rel="noopener noreferrer"
            className="relative h-12 w-auto cursor-pointer outline-none hover:opacity-80 focus-visible:outline-none"
          >
            <Image
              src="/images/crafd-logo-full-white.svg"
              alt="CRAF'd Logo"
              width={100}
              height={66}
              className="h-full w-auto object-contain"
            />
          </a>
          {/* Title */}
          <h1 className="font-qanelas text-3xl leading-none font-extrabold tracking-tight text-white">
            CRAF'd Transparency Portal
          </h1>
        </div>
        {/* Middle Image */}
        <div className="flex flex-1 items-center justify-center self-stretch overflow-hidden">
          <Image
            src="/images/crafd-wide-header.png"
            alt="CRAF'd"
            width={600}
            height={80}
            className="h-full w-full object-cover"
          />
        </div>
        {/* Tab Buttons and View Selector on Right */}
        <div className="flex items-center gap-4">
          {/* View Selector for Project Data */}
          <Select
            value={activeView}
            onValueChange={setActiveView}
            disabled={!showViewSelector}
          >
            <HeaderSelectTrigger
              className={cn("w-35", !showViewSelector && "invisible")}
            >
              <SelectValue />
            </HeaderSelectTrigger>
            <HeaderSelectContent>
              {views.map((view) => (
                <SelectItem key={view.value} value={view.value}>
                  <div className="flex items-center gap-2">
                    {viewIcons[view.value]}
                    <span>{view.label}</span>
                  </div>
                </SelectItem>
              ))}
            </HeaderSelectContent>
          </Select>
          {/* Tab Buttons */}
          <nav className="flex gap-2">
            {NAVIGATION_ITEMS.map((nav) => {
              const Icon = nav.icon;
              const isActive = currentNav?.value === nav.value;

              return (
                <Link
                  key={nav.value}
                  href={nav.href}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded border px-3 py-1.5 text-sm font-semibold outline-none focus-visible:outline-none",
                    isActive
                      ? "border-crafd-yellow bg-crafd-yellow text-black"
                      : "border-crafd-yellow text-white hover:bg-crafd-yellow/20",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {nav.shortLabel || nav.label}
                </Link>
              );
            })}
          </nav>
          {/* Logout Button */}
          <a
            href="/logout"
            className="flex h-9 items-center gap-2 rounded px-3 py-1.5 text-sm font-semibold text-white outline-none hover:bg-crafd-yellow/20 focus-visible:outline-none"
          >
            <LogOut className="h-4 w-4" />
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
            className="relative h-12 w-auto cursor-pointer outline-none hover:opacity-80 focus-visible:outline-none"
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
            className="flex h-9 items-center gap-2 rounded px-3 py-1.5 text-sm font-semibold text-white outline-none hover:bg-crafd-yellow/20 focus-visible:outline-none"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </a>
        </div>

        {/* Title */}
        <h1 className="font-qanelas text-xl leading-tight font-extrabold tracking-tight text-white sm:text-2xl">
          CRAF'd Transparency Portal
        </h1>

        {/* Controls Row: Tab Selector and View Selector */}
        <div className="flex items-center gap-3">
          {/* Tab Selector (Mobile) */}
          <Select
            value={currentNav?.value || "data"}
            onValueChange={handleNavChange}
          >
            <HeaderSelectTrigger className="flex-1">
              <SelectValue />
            </HeaderSelectTrigger>
            <HeaderSelectContent>
              {NAVIGATION_ITEMS.map((nav) => {
                const Icon = nav.icon;
                return (
                  <SelectItem key={nav.value} value={nav.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{nav.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </HeaderSelectContent>
          </Select>

          {/* View Selector (Mobile) */}
          <Select
            value={activeView}
            onValueChange={setActiveView}
            disabled={!showViewSelector}
          >
            <HeaderSelectTrigger
              className={cn("w-35", !showViewSelector && "invisible")}
            >
              <SelectValue />
            </HeaderSelectTrigger>
            <HeaderSelectContent>
              {views.map((view) => (
                <SelectItem key={view.value} value={view.value}>
                  <div className="flex items-center gap-2">
                    {viewIcons[view.value]}
                    <span>{view.label}</span>
                  </div>
                </SelectItem>
              ))}
            </HeaderSelectContent>
          </Select>
        </div>
      </div>
    </header>
  );
}
