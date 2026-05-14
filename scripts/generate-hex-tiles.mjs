/**
 * Precomputes the geographic hex tile grid and writes public/data/hex-tiles.json.
 * Run once (or after changing resolution):
 *   node scripts/generate-hex-tiles.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const d3 = await import("d3");
const topojson = await import("topojson-client");
const { hexbin: d3hexbin } = await import("d3-hexbin");

const WIDTH = 1600;
const HEIGHT = 900;
const HEX_RADIUS = 9.5;
const SAMPLE_STEP = 8;

const projection = d3.geoNaturalEarth1()
  .scale(330)
  .translate([WIDTH / 2, HEIGHT / 2 - 110]);

const hexbin = d3hexbin()
  .radius(HEX_RADIUS)
  .extent([[0, 0], [WIDTH, HEIGHT]]);

function getRegion(lon, lat) {
  if (lat < -58) return null;
  if (lon >= -85 && lon <= -58 && lat >= 10 && lat <= 27) return "Caribbean";
  if (lon >= -120 && lon <= -77 && lat >= 7 && lat < 30)  return "Central America";
  if (lon >= -82 && lon <= -34 && lat >= -56 && lat < 13) return "South America";
  if (lon >= -170 && lon <= -50 && lat >= 24 && lat <= 85) return "Northern America";
  if (lon >= -25 && lon <= 40 && lat >= 56) return "Northern Europe";
  if (lon >= -12 && lon <= 8 && lat >= 43 && lat < 56) return "Western Europe";
  if (lon >= -10 && lon <= 35 && lat >= 35 && lat < 43) return "Southern Europe";
  if (lon >= 8 && lon <= 60 && lat >= 43 && lat < 56) return "Eastern Europe";
  if (lon >= -17 && lon <= 40 && lat >= 20 && lat < 38) return "Northern Africa";
  if (lon >= -20 && lon <= 15 && lat >= 0 && lat < 20) return "Western Africa";
  if (lon >= 8 && lon <= 32 && lat >= -10 && lat < 20) return "Middle Africa"; // expanded lat (fills Chad/CAR gap)
  if (lon >= 28 && lon <= 52 && lat >= -12 && lat < 22) return "Eastern Africa"; // expanded lat (fills Eritrea/Horn gap)
  if (lon >= 10 && lon <= 42 && lat >= -35 && lat < -10) return "Southern Africa";
  if (lon >= 30 && lon <= 60 && lat >= 20 && lat < 42) return "Western Asia";
  if (lon >= 50 && lon <= 90 && lat >= 36 && lat < 56) return "Central Asia";
  if (lon >= 60 && lon <= 92 && lat >= 5 && lat < 36) return "Southern Asia";
  if (lon >= 92 && lon <= 145 && lat >= 22 && lat < 52) return "Eastern Asia";
  if (lon >= 92 && lon <= 140 && lat >= -12 && lat < 22) return "Southeastern Asia";
  if (lon >= 110 && lon <= 180 && lat >= -48 && lat < -10) return "Australia and New Zealand";
  if (lon >= 130 && lon <= 165 && lat >= 5 && lat < 25) return "Micronesia";
  if (lon >= 140 && lon <= 180 && lat >= -15 && lat < 5) return "Melanesia";
  if ((lon >= 165 || lon <= -120) && lat >= -25 && lat < 10) return "Polynesia";
  return null;
}

console.log("Fetching world atlas...");
const world = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json");
const land = topojson.feature(world, world.objects.land);

console.log("Sampling points...");
const labeledPoints = [];
for (let y = -20; y <= HEIGHT + 20; y += SAMPLE_STEP) {
  for (let x = -20; x <= WIDTH + 20; x += SAMPLE_STEP) {
    const lonLat = projection.invert([x, y]);
    if (!lonLat) continue;
    const [lon, lat] = lonLat;
    if (lat > -58 && d3.geoContains(land, [lon, lat])) {
      const region = getRegion(lon, lat);
      if (region) labeledPoints.push([x, y, region]);
    }
  }
}
console.log(`Sampled ${labeledPoints.length} land points`);

console.log("Binning into hexagons...");
const bins = hexbin(labeledPoints);

const tilesByRegion = {};
for (const bin of bins) {
  const counts = {};
  bin.forEach((pt) => { counts[pt[2]] = (counts[pt[2]] || 0) + 1; });
  const region = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  if (!tilesByRegion[region]) tilesByRegion[region] = [];
  tilesByRegion[region].push({ x: Math.round(bin.x * 10) / 10, y: Math.round(bin.y * 10) / 10 });
}

const totalTiles = Object.values(tilesByRegion).reduce((s, arr) => s + arr.length, 0);
console.log(`Generated ${totalTiles} hex tiles across ${Object.keys(tilesByRegion).length} regions`);

const outDir = join(ROOT, "public", "data");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "hex-tiles.json");
const payload = { width: WIDTH, height: HEIGHT, hexRadius: HEX_RADIUS, tilesByRegion };
writeFileSync(outPath, JSON.stringify(payload, null, 0));
console.log(`Written to ${outPath} (${(Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(1)} KB)`);
