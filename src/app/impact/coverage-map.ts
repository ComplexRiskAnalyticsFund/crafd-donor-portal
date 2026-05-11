export const UN_REGIONS = [
  "Global",
  "Northern America",
  "Central America",
  "Caribbean",
  "South America",
  "Northern Europe",
  "Western Europe",
  "Eastern Europe",
  "Southern Europe",
  "Northern Africa",
  "Western Africa",
  "Middle Africa",
  "Eastern Africa",
  "Southern Africa",
  "Western Asia",
  "Central Asia",
  "Southern Asia",
  "Eastern Asia",
  "Southeastern Asia",
  "Australia and New Zealand",
  "Melanesia",
  "Micronesia",
  "Polynesia",
] as const;

export type UNRegion = typeof UN_REGIONS[number];

// Maps free-text project_coverage values to one or more UN geoscheme region names.
// Keys are lower-cased for matching.
const COVERAGE_MAP: Record<string, UNRegion[]> = {
  "global":                              ["Global"],
  "all low-and middle-income countries": ["Global"],
  "all low- and middle-income countries":["Global"],

  "east africa":                         ["Eastern Africa"],
  "eastern africa":                      ["Eastern Africa"],
  "west africa":                         ["Western Africa"],
  "western africa":                      ["Western Africa"],
  "middle africa":                       ["Middle Africa"],
  "central africa":                      ["Middle Africa"],
  "north africa":                        ["Northern Africa"],
  "northern africa":                     ["Northern Africa"],
  "south africa":                        ["Southern Africa"],
  "southern africa":                     ["Southern Africa"],
  "sub-saharan africa":                  ["Western Africa", "Middle Africa", "Eastern Africa", "Southern Africa"],
  "africa":                              ["Northern Africa", "Western Africa", "Middle Africa", "Eastern Africa", "Southern Africa"],

  "west and east africa":                ["Western Africa", "Eastern Africa"],
  "west & east africa":                  ["Western Africa", "Eastern Africa"],
  "clifdew-grid":                        ["Western Africa", "Eastern Africa"],

  "middle east":                         ["Western Asia"],
  "mena":                                ["Western Asia", "Northern Africa"],
  "middle east and north africa":        ["Western Asia", "Northern Africa"],
  "western asia":                        ["Western Asia"],
  "central asia":                        ["Central Asia"],
  "south asia":                          ["Southern Asia"],
  "southern asia":                       ["Southern Asia"],
  "east asia":                           ["Eastern Asia"],
  "eastern asia":                        ["Eastern Asia"],
  "southeast asia":                      ["Southeastern Asia"],
  "southeastern asia":                   ["Southeastern Asia"],
  "asia":                                ["Western Asia", "Central Asia", "Southern Asia", "Eastern Asia", "Southeastern Asia"],

  "middle east, central & west africa":  ["Western Asia", "Central Asia", "Western Africa", "Middle Africa"],

  // Country-level mappings
  "kenya":                               ["Eastern Africa"],
  "somalia":                             ["Eastern Africa"],
  "south sudan":                         ["Eastern Africa"],
  "somalia, south sudan":                ["Eastern Africa"],
  "ethiopia":                            ["Eastern Africa"],
  "nigeria":                             ["Western Africa"],
  "drc":                                 ["Middle Africa"],
  "democratic republic of congo":        ["Middle Africa"],
};

/** Returns the list of UN regions a project_coverage string maps to. */
export function coverageToRegions(coverage: string | null): UNRegion[] {
  if (!coverage) return ["Global"];
  const key = coverage.trim().toLowerCase();

  // Exact match first
  if (COVERAGE_MAP[key]) return COVERAGE_MAP[key];

  // Partial match — check if any key is a substring of coverage or vice versa
  for (const [k, regions] of Object.entries(COVERAGE_MAP)) {
    if (key.includes(k) || k.includes(key)) return regions;
  }

  return ["Global"];
}
