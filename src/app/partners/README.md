# `/partners` — Partner Network Visualization

Interactive hexagonal force-graph showing all CRAF'd partner organizations, grouped by connection type and linked to their joint projects.

---

## File Map

```
src/app/partners/
  page.tsx                    Server component — data fetching & node layout
  PartnersVizClient.tsx       Main client component — SVG canvas, pan/zoom, interaction
  PartnersVizClientInner.tsx  (unused/legacy) GSAP fly-in animation prototype

src/lib/partners/
  label.ts                    Partner classification + hex grid layout algorithm
  coverage-regions.ts         project_coverage string → ISO numeric country codes

src/lib/data/
  partners.ts                 fs-based loaders for all static JSON data files

src/types/index.ts            Partner, CrafdProject, PartnerLabel types

public/data/uv 
  partners.json               All non-donor partner records (from Airtable sync)
  donors.json                 The 8 donor-country partners (separate to control ordering)
  projects.json               Project metadata (title, blurb, grant size, coverage, status)
  viz-meta.json               { as_of, anon_partner_count } — controls the "& Many More" hex
  countries-110m.json         TopoJSON world atlas (110m resolution) for CoverageMap

public/white_logos/           White partner logos (full + thumb subdirectory)
public/logos/color/           Color partner logos (override white_logos for detail panel)
```

---

## Data Flow

```
Airtable (source of truth)
  └── sync script (external) ──► public/data/partners.json
                                  public/data/donors.json
                                  public/data/projects.json
                                  public/data/viz-meta.json

page.tsx (server, runs at request time)
  ├── getPartners()     reads public/data/partners.json
  ├── getDonors()       reads public/data/donors.json
  ├── getVizMeta()      reads public/data/viz-meta.json
  ├── getProjects()     reads public/data/projects.json
  ├── buildPartnerHexNodes([...donors, ...partners], 75, anonCount)
  │     └── returns HexNode[]  (pixel coords, kind, label, partner ref)
  ├── scans public/white_logos/ and public/logos/color/ for logo files
  │     └── builds partnerLogos / partnerLogoThumbs  Record<slug, path>
  └── passes everything as serialised props → PartnersVizClient
```

Donors are prepended to the partners array so `buildPartnerHexNodes` processes their group first, preventing UN partners from spreading into adjacent cells before donor positions are blocked.

---

## Hex Grid Algorithm (`src/lib/partners/label.ts`)

All geometry uses **flat-top axial coordinates** (`q`, `r`). `axialToPixel` converts to SVG pixel space.

**`labelPartner(p: Partner) → PartnerLabel`**  
Maps `crafd_connection` strings to one of five labels: `donor | project | un | collaborating | other`.

**`buildPartnerHexNodes(partners, size, anonCount) → HexNode[]`**

1. **Dedup** — partners with the same `org_short_name` are merged; their `relational_project` lists are unioned.
2. **Filter** — CRAF'd itself, MPTFO, and administrative agents are excluded.
3. **Group** — partners are bucketed by their `PartnerLabel`. ActionAid is hard-coded to `collaborating` regardless of its raw connection type.
4. **Hub** — 7 hexes at the center (axial origin + 6 neighbors) become `outline` nodes. A large white `center` hex overlays them with the CRAF'd logo.
5. **Label anchors** — each group gets a fixed axial anchor adjacent to the hub (e.g. collaborating → `{q:-2,r:1}`). These become `label` hex nodes.
6. **Wedge growth** — `generateWedgeOffsets(n, wedgeDirs)` generates candidate axial offsets expanding outward in a directional wedge. `pickPositionsWithBlockFilter` selects the first `n` non-blocked cells, then blocks them for subsequent groups.
7. **"& Many More"** — after the collaborating group, one extra `more` node is placed at the next free wedge cell, showing `viz-meta.anon_partner_count`.

`HexNode` fields of interest:

- `kind` — `"partner" | "label" | "center" | "outline" | "more"`
- `label` — which group (`PartnerLabel`) the node belongs to
- `partner` — full `Partner` record (only on `kind === "partner"`)
- `x`, `y`, `r` — pixel position and hex radius

---

## PartnersVizClient — Interaction Model

The SVG is rendered inside a full-screen div. `viewBox` is `"-900 -500 1800 1000"` and a CSS `transform` applies pan + scale.

**Pan / Zoom**

- Mouse drag → updates `pan` state (clamped via `clampPan` against `GRID_LIMIT * scale`).
- Wheel → updates `scale`.
- Touch: one-finger drag for pan, two-finger pinch for scale (via `pinchStartRef` / `touchStartRef`).

**Hover / Selection**

- `hoveredPartner` (node id) — dims all other partners, highlights matching project lines.
- `hoveredLabel` (label string) — highlights all partners in the group.
- `lockedGroup` — a `Set<string>` of node ids locked by clicking a label hex; persists until another click.
- `lockedFeature` + `lockedSourceNode` — partner-level lock from clicking a partner hex; drives the detail panel.
- `clickedNode` — the currently selected partner node, displayed in the side panel.

**URL state**  
`?partner=<org_short_name>` is read on mount via `useSearchParams` to pre-select a partner (deep-link support). Selection updates the URL without a full navigation (`router.push`).

**Project connection lines**  
Drawn as SVG `<line>` elements between any two partner hexes that share at least one entry in `relational_project`. Line style (dash pattern) varies by project using `PROJECT_LINE_DASHES`. Visibility is driven by hover/lock state.

**Logo slugification**  
`toLogoSlug(name)` converts `org_short_name` to the kebab-case filename used in `public/white_logos/` (spaces/slashes/underscores → `-`, special chars stripped).

**Detail panel (desktop) / bottom sheet (mobile)**  
Clicking a partner hex opens a panel showing: logo, full name, connection type, grant total, project list (accordion), and a `CoverageMap` for the selected project.

---

## CoverageMap (`CoverageMap.tsx`)

Renders a small D3 world map inside the detail panel.

- Fetches `public/data/countries-110m.json` once (cached in module-level `geoCache`).
- Receives a `coverage` string (e.g. `"East Africa"`, `"Global"`).
- Looks up `COVERAGE_COUNTRY_IDS[coverage]` to get a list of ISO numeric country codes.
  - `null` entry → highlight all land (global coverage).
  - Missing key → highlight nothing (unrecognized string).
- Draws with `d3-geo` + `topojson-client`; uses Natural Earth projection.
- Antarctica (id `10`) is always excluded.

---

## Adding / Updating Data

- **New partners** — update `public/data/partners.json` (or re-run the Airtable sync).
- **Donor list** — edit `public/data/donors.json`; donors always render in the `donor` group regardless of `crafd_connection`.
- **Anonymous count** — change `anon_partner_count` in `public/data/viz-meta.json`.
- **New project coverage region** — add an entry to `COVERAGE_COUNTRY_IDS` in `src/lib/partners/coverage-regions.ts`.
- **Logos** — drop `<org_short_name_slug>.png` (or `.svg`) into `public/white_logos/` (white version) and/or `public/logos/color/` (color version). The slug is produced by `toLogoSlug(org_short_name)`.
