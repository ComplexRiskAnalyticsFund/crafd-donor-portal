// src/lib/data/partners.ts

import type { Partner, CrafdProject } from "@/types";
import { readFile } from "fs/promises";
import path from "path";

/**
 * Fetches all partners from the static JSON file
 * Optimized for Vercel deployment with static data caching
 */
export async function getPartners(): Promise<Partner[]> {
  const filePath = path.join(process.cwd(), "public/data/partners.json");
  const fileContents = await readFile(filePath, "utf8");
  return JSON.parse(fileContents);
}

/**
 * Fetches the 8 donor-country partners from the static JSON file
 */
export async function getDonors(): Promise<Partner[]> {
  const filePath = path.join(process.cwd(), "public/data/donors.json");
  const fileContents = await readFile(filePath, "utf8");
  return JSON.parse(fileContents);
}

/**
 * Fetches visualization metadata (as-of date, anonymous partner count)
 */
export async function getVizMeta(): Promise<{
  as_of: string;
}> {
  const filePath = path.join(process.cwd(), "public/data/viz-meta.json");
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function getProjects(): Promise<CrafdProject[]> {
  const filePath = path.join(process.cwd(), "public/data/projects.json");
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function getOrgsMap(): Promise<Record<string, string>> {
  const filePath = path.join(process.cwd(), "public/data/partners.json");
  const data: Partner[] = JSON.parse(await readFile(filePath, "utf8"));
  const map: Record<string, string> = {};
  for (const o of data) {
    if (o.airtable_id) map[o.airtable_id] = o.org_short_name;
  }
  return map;
}
