import type { UNRegion } from "./coverage-map";

export interface GridRegion {
  name: UNRegion;
  col: number;
  row: number;
}

// Flat-top hex grid, offset layout (odd rows shifted right by 0.5 col).
// Coordinates are approximate geographic positions within a ~8×6 grid.
// "Global" is rendered separately as a special tile, not in the grid.
export const GRID_REGIONS: GridRegion[] = [
  // Americas
  { name: "Northern America", col: 0, row: 0 },
  { name: "Central America", col: 0, row: 1 },
  { name: "Caribbean", col: 1, row: 1 },
  { name: "South America", col: 0, row: 2 },

  // Europe
  { name: "Northern Europe", col: 2, row: 0 },
  { name: "Western Europe", col: 2, row: 1 },
  { name: "Southern Europe", col: 2, row: 2 },
  { name: "Eastern Europe", col: 3, row: 0 },

  // Africa
  { name: "Northern Africa", col: 3, row: 2 },
  { name: "Western Africa", col: 3, row: 3 },
  { name: "Middle Africa", col: 3, row: 4 },
  { name: "Eastern Africa", col: 4, row: 3 },
  { name: "Southern Africa", col: 4, row: 4 },

  // Asia
  { name: "Western Asia", col: 4, row: 1 },
  { name: "Central Asia", col: 4, row: 0 },
  { name: "Southern Asia", col: 5, row: 1 },
  { name: "Eastern Asia", col: 5, row: 0 },
  { name: "Southeastern Asia", col: 6, row: 1 },

  // Oceania
  { name: "Australia and New Zealand", col: 7, row: 2 },
  { name: "Melanesia", col: 7, row: 1 },
  { name: "Micronesia", col: 7, row: 0 },
  { name: "Polynesia", col: 8, row: 1 },
];

// Hex geometry helpers — pointy-top hexagons
export const HEX_SIZE = 52; // circumradius
export const H_SPACING = HEX_SIZE * Math.sqrt(3); // col pitch
export const V_SPACING = HEX_SIZE * 1.5; // row pitch
export const GRID_COLS = 9;
export const GRID_ROWS = 5;
export const SVG_W = Math.ceil((GRID_COLS + 0.5) * H_SPACING + HEX_SIZE * 2);
export const SVG_H = Math.ceil(GRID_ROWS * V_SPACING + HEX_SIZE * 2);

/** Screen centre (x, y) for a grid cell. Even rows: normal, odd rows: offset by H_SPACING/2 */
export function hexCenter(col: number, row: number): [number, number] {
  const offsetX = row % 2 === 1 ? H_SPACING / 2 : 0;
  const x = HEX_SIZE + col * H_SPACING + offsetX;
  const y = HEX_SIZE + row * V_SPACING;
  return [x, y];
}

/** SVG polygon `points` string for a pointy-top regular hexagon centred at (cx, cy). */
export function hexPoints(cx: number, cy: number, r = HEX_SIZE * 0.94): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(" ");
}
