"use client";

import ImpactMap from "./ImpactMap";
import type { CrafdProject } from "@/types";

interface Props {
  projects: CrafdProject[];
  orgs: Record<string, string>;
  variant?: "flat" | "density" | "dark";
}

export default function ImpactMapClient(props: Props) {
  return <ImpactMap {...props} />;
}
