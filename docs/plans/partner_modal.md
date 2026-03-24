# Partner Detail Modal

## Context

The `/partners` page shows a hex-grid visualization of CRAF'd partners. Clicking a partner hex should open a modal overlay showing partner details, styled per the Figma design (dark modal on blurred background, logo, project title, description, stats cards, CTA buttons).

The design shows: large dark (near-black) rounded modal, partner logo top-left, bold project title, description paragraph, 4 stat cards (Status, Coverage, Grant Size, Duration), 3 yellow CTA buttons at the bottom, and an X close button.

Since data fields (project title, description, status, coverage, grant size, duration, project links) don't exist yet in `partners.json`, the modal will be built to accept them as **optional fields** and display placeholders/empty states when not present. Fields will be added to the JSON later.

## Files to Modify

- `src/app/partners/PartnersVizClient.tsx` — add click handler on partner nodes, render modal
- `src/types/index.ts` — extend `Partner` with optional detail fields
- `public/data/partners.json` — no change needed now (new fields added later)

## Existing Utilities to Reuse

- `src/components/ui/dialog.tsx` — shadcn Dialog primitive (Radix)
- `Partner` type in `src/types/index.ts`
- `HexNode` type in `src/lib/partners/label.ts` (already has `partner?: Partner`)

## Implementation Plan

### 1. Extend `Partner` type (`src/types/index.ts`)

Add optional fields that will be populated later:

```ts
project_title?: string;
project_description?: string;
project_status?: string;
grant_size?: string;
project_duration_months?: number;
coverage_map_path?: string;  // path to a coverage image
project_overview_url?: string;
project_impact_url?: string;
mptfo_url?: string;
```

### 2. Create `PartnerModal` component (`src/app/partners/PartnerModal.tsx`)

A `"use client"` component using the shadcn `Dialog` (already installed). Structure:

- Dark (`bg-black/90`) rounded-[43px] modal, max-w ~1000px
- **Header**: logo img (if `logo_path`) + fallback org_short_name box, bold uppercase `project_title` (fallback: `org_short_name`)
- **Description**: `project_description` paragraph (hidden if empty)
- **Stats row**: 4 bordered rounded cards:
  - Status: `project_status` or "—"
  - Coverage: `coverage_map_path` img or "—"
  - Grant Size: `grant_size` or "—"
  - Duration: `project_duration_months` + "Months" or "—"
- **CTA buttons**: 3 yellow (`bg-[#fdb53c]`) rounded buttons — "Project Overview", "Project Impact", "MPTFO Page" — shown only if the corresponding URL exists, otherwise all 3 shown as disabled/placeholder
- **Close button**: X icon top-right

### 3. Add click handler in `PartnersVizClient.tsx`

- Add `selectedPartner: Partner | null` state
- On partner hex click: `setSelectedPartner(n.partner ?? null)`
- Distinguish click vs. pan: only fire if pointer didn't move (track `pointerDownPos`, compare on `pointerUp`)
- Change partner cursor to `"pointer"`
- Render `<PartnerModal partner={selectedPartner} onClose={() => setSelectedPartner(null)} />`

## Click vs Pan Detection

Track pointer down position. In `handlePointerUp`, if `isPanning.current` was triggered by movement (dx/dy > 4px), don't open modal. Use a `didPan` ref set in `handlePointerMove`.

## Verification

1. `pnpm dev` — visit `/partners`
2. Click any partner hex → modal opens with partner name
3. Close via X or clicking outside → modal dismisses
4. Pan/drag does NOT trigger modal open
5. Partners without detail data show graceful placeholders
