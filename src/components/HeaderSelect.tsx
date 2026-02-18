"use client";

import { SelectContent, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import * as React from "react";

export function HeaderSelectTrigger({
  className,
  ...props
}: React.ComponentProps<typeof SelectTrigger>) {
  return (
    <SelectTrigger
      className={cn(
        "h-9 rounded border border-crafd-yellow bg-black text-sm text-white hover:bg-crafd-yellow/10 focus-visible:ring-0 focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function HeaderSelectContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectContent>) {
  return (
    <SelectContent
      className={cn(
        "border-crafd-yellow bg-black text-white data-[state=closed]:animate-none data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-0 data-[state=open]:animate-none data-[state=open]:fade-in-0 data-[state=open]:zoom-in-0",
        className,
      )}
      {...props}
    >
      {children}
    </SelectContent>
  );
}
