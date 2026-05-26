"use client";

import dynamic from "next/dynamic";
import type { CrafdProject } from "@/types";

const ImpactMap = dynamic(() => import("./ImpactMap"), { ssr: false });

interface Props {
  projects: CrafdProject[];
  orgs: Record<string, string>;
  variant?: "flat" | "density" | "dark";
}

export default function ImpactMapClient(props: Props) {
  return <ImpactMap {...props} />;
}
