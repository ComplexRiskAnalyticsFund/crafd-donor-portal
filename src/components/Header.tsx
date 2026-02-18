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
    label: "Projects",
    href: "/data",
    icon: Grid,
    exact: true,
  },
  {
    value: "steerco-data",
    label: "Decisions",
    href: "/data/steerco",
    icon: BarChart3,
    exact: false,
  },
  {
    value: "contacts",
    label: "Contacts",
    href: "/data/contacts",
    icon: Users,
    exact: false,
  },
  {
    value: "partners",
    label: "Partners",
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

  const handleNavChange = (value: string) => {
    const navItem = NAVIGATION_ITEMS.find((item) => item.value === value);
    if (navItem) {
      router.push(navItem.href);
    }
  };

  return (
    <header className="relative z-40 shrink-0 overflow-hidden bg-black px-3 py-3 transition-all duration-200 sm:px-2 sm:py-0 md:px-3 lg:px-4">
      {/* Background Image */}
      <div className="pointer-events-none absolute inset-0 opacity-10 sm:opacity-20 md:opacity-30">
        <Image
          src="/images/crafd-wide-header.png"
          alt="CRAF'd Background"
          fill
          className="object-cover object-center"
          priority
        />
      </div>

      {/* Desktop/Tablet Layout */}
      <div className="relative hidden items-center justify-between gap-3 sm:flex sm:h-14 md:h-16 lg:h-20 lg:gap-4 xl:gap-6">
        {/* Logo and Title */}
        <div className="flex items-center gap-2 lg:gap-3 xl:gap-4">
          {/* Logo */}
          <a
            href="https://crafd.io"
            target="_blank"
            rel="noopener noreferrer"
            className="relative h-9 w-auto shrink-0 cursor-pointer transition-opacity duration-200 outline-none hover:opacity-80 focus-visible:outline-none sm:h-10 md:h-11 lg:h-12"
          >
            <Image
              src="/images/crafd-logo-full-white.svg"
              alt="CRAF'd Logo"
              width={100}
              height={66}
              className="h-full w-auto object-contain"
              priority
            />
          </a>
          {/* Title */}
          <h1 className="font-qanelas text-base leading-none font-extrabold tracking-tight whitespace-nowrap text-white transition-all duration-200 sm:text-lg md:text-xl lg:text-2xl xl:text-3xl">
            CRAF'd Transparency Portal
          </h1>
        </div>

        {/* Tab Buttons and View Selector on Right */}
        <div className="flex items-center gap-2 lg:gap-3 xl:gap-4">
          {/* View Toggle for Project Data */}
          {showViewSelector && (
            <div className="flex h-9 items-stretch gap-1 rounded border border-crafd-yellow p-0.5">
              <button
                onClick={() => setActiveView("grid")}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded px-3 transition-all duration-200",
                  activeView === "grid"
                    ? "bg-crafd-yellow text-black shadow-sm"
                    : "text-white hover:bg-crafd-yellow/20",
                )}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden text-sm font-semibold lg:inline">
                  Grid
                </span>
              </button>
              <button
                onClick={() => setActiveView("list")}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded px-3 transition-all duration-200",
                  activeView === "list"
                    ? "bg-crafd-yellow text-black shadow-sm"
                    : "text-white hover:bg-crafd-yellow/20",
                )}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
                <span className="hidden text-sm font-semibold lg:inline">
                  List
                </span>
              </button>
            </div>
          )}

          {/* Tab Buttons */}
          <nav className="flex gap-1.5 lg:gap-2">
            {NAVIGATION_ITEMS.map((nav) => {
              const Icon = nav.icon;
              const isActive = currentNav?.value === nav.value;

              return (
                <Link
                  key={nav.value}
                  href={nav.href}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded border px-2 py-1.5 text-xs font-semibold transition-all duration-200 outline-none focus-visible:outline-none sm:text-xs md:h-9 md:gap-2 md:px-3 md:text-sm lg:text-sm",
                    isActive
                      ? "border-crafd-yellow bg-crafd-yellow text-black shadow-md"
                      : "border-crafd-yellow text-white hover:bg-crafd-yellow/20 hover:shadow-sm",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                  <span className="hidden lg:inline">{nav.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout Button */}
          <a
            href="/logout"
            className="flex h-8 items-center gap-2 rounded px-2 py-1.5 text-sm font-semibold text-white transition-all duration-200 outline-none hover:bg-crafd-yellow/20 hover:shadow-sm focus-visible:outline-none sm:px-2.5 md:h-9 md:px-3"
          >
            <LogOut className="h-3.5 w-3.5 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
          </a>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="relative flex flex-col gap-2.5 sm:hidden">
        {/* Top Row: Logo, Title and Logout */}
        <div className="flex items-center justify-between gap-2 overflow-hidden">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <a
              href="https://crafd.io"
              target="_blank"
              rel="noopener noreferrer"
              className="relative h-8 w-auto shrink-0 cursor-pointer transition-opacity duration-200 outline-none hover:opacity-80 focus-visible:outline-none sm:h-10"
            >
              <Image
                src="/images/crafd-logo-full-white.svg"
                alt="CRAF'd Logo"
                width={80}
                height={53}
                className="h-full w-auto object-contain"
                priority
              />
            </a>
            {/* Title inline with logo on mobile */}
            <h1 className="font-qanelas min-w-0 flex-1 overflow-hidden text-sm leading-tight font-extrabold tracking-tight text-ellipsis whitespace-nowrap text-white transition-all duration-200 sm:text-base md:text-lg">
              CRAF'd Transparency Portal
            </h1>
          </div>
          <a
            href="/logout"
            className="flex h-8 shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-semibold text-white transition-all duration-200 outline-none hover:bg-crafd-yellow/20 hover:shadow-sm focus-visible:outline-none sm:h-9 sm:gap-2 sm:px-3"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
          </a>
        </div>

        {/* Controls Row: Tab Selector and View Selector */}
        <div className="flex items-stretch gap-2 overflow-hidden">
          {/* Tab Selector (Mobile) */}
          <Select
            value={currentNav?.value || "data"}
            onValueChange={handleNavChange}
          >
            <HeaderSelectTrigger className="h-9 w-36 transition-all duration-200 sm:w-40">
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

          {/* View Toggle (Mobile) - Icon Buttons */}
          {showViewSelector && (
            <div className="flex h-9 items-stretch gap-1 rounded border border-crafd-yellow p-0.5">
              <button
                onClick={() => setActiveView("grid")}
                className={cn(
                  "flex items-center justify-center rounded px-2.5 transition-all duration-200",
                  activeView === "grid"
                    ? "bg-crafd-yellow text-black"
                    : "text-white hover:bg-crafd-yellow/20",
                )}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setActiveView("list")}
                className={cn(
                  "flex items-center justify-center rounded px-2.5 transition-all duration-200",
                  activeView === "list"
                    ? "bg-crafd-yellow text-black"
                    : "text-white hover:bg-crafd-yellow/20",
                )}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
