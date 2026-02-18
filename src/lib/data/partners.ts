import type { Partner, PartnerStats } from "@/types";
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
 * Filters partners by connection type
 */
export function filterPartnersByConnection(
  partners: Partner[],
  connectionType: string,
): Partner[] {
  return partners.filter((partner) =>
    partner.crafd_connection.includes(connectionType),
  );
}

/**
 * Gets a partner by short name
 */
export function getPartnerByShortName(
  partners: Partner[],
  shortName: string,
): Partner | undefined {
  return partners.find(
    (partner) => partner.org_short_name.trim() === shortName.trim(),
  );
}

/**
 * Gets partners with logos
 */
export function getPartnersWithLogos(partners: Partner[]): Partner[] {
  return partners.filter((partner) => partner.logo_path !== null);
}

/**
 * Groups partners by connection type
 */
export function groupPartnersByConnection(
  partners: Partner[],
): Record<string, Partner[]> {
  const grouped: Record<string, Partner[]> = {};

  partners.forEach((partner) => {
    const connections = partner.crafd_connection
      .split(",")
      .map((c) => c.trim());

    connections.forEach((connection) => {
      if (!grouped[connection]) {
        grouped[connection] = [];
      }
      grouped[connection].push(partner);
    });
  });

  return grouped;
}

/**
 * Gets statistics about partners
 * Useful for dashboard visualizations
 */
export function getPartnerStats(partners: Partner[]): PartnerStats {
  const grouped = groupPartnersByConnection(partners);
  const withLogos = getPartnersWithLogos(partners);

  return {
    total: partners.length,
    withLogos: withLogos.length,
    withoutLogos: partners.length - withLogos.length,
    byConnectionType: Object.entries(grouped).map(([type, items]) => ({
      type,
      count: items.length,
    })),
  };
}

/**
 * Sorts partners alphabetically by short name
 */
export function sortPartnersByName(partners: Partner[]): Partner[] {
  return [...partners].sort((a, b) =>
    a.org_short_name.trim().localeCompare(b.org_short_name.trim()),
  );
}

/**
 * Searches partners by name (short or full)
 */
export function searchPartners(partners: Partner[], query: string): Partner[] {
  const lowerQuery = query.toLowerCase().trim();
  return partners.filter(
    (partner) =>
      partner.org_short_name.toLowerCase().includes(lowerQuery) ||
      partner.org_full_name.toLowerCase().includes(lowerQuery),
  );
}

/**
 * Gets unique connection types from all partners
 */
export function getUniqueConnectionTypes(partners: Partner[]): string[] {
  const types = new Set<string>();
  partners.forEach((partner) => {
    partner.crafd_connection
      .split(",")
      .map((c) => c.trim())
      .forEach((type) => types.add(type));
  });
  return Array.from(types).sort();
}
