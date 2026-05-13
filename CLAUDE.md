# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

**When starting work on a Next.js project, ALWAYS call the `init` tool from
next-devtools-mcp FIRST to set up proper context and establish documentation
requirements. Do this automatically without being asked.**

## Commands

- `pnpm dev` - Start dev server
- `pnpm build` - Production build
- `pnpm lint` - ESLint (flat config, `eslint.config.mjs`)
- `npx tsc --noEmit` - Type check
- `npx shadcn@latest add <component>` - Add shadcn/ui components (never use `shadcn-ui`)

## Architecture

**CRAF'd Donor Portal** - Next.js 16 transparency dashboard for UN CRAF'd initiative donors. Deployed on Vercel.

### Stack

- Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS v4, pnpm
- UI: shadcn/ui (Radix primitives) in `components/ui/`, Lucide icons, Framer Motion, GSAP, Recharts, d3-force
- Data: PostgreSQL (pg), Airtable sync, static JSON in `public/data/`
- Auth: Cookie-based (`site_auth=1`) with env credentials, timing-safe comparison

### Key Patterns

**Iframe-based dashboard**: Main content embeds Airtable views as persistent iframes. `IframeLayer` renders all iframes on mount and toggles visibility via CSS only (never unmounts) to preserve loaded state across tab switches. Tab config is the single source of truth in `src/config/airtable.ts`.

**Route structure**:

- `(dashboard)` route group: auth-gated (server-side check in layout + middleware in `src/proxy.ts`)
- `/` redirects to `/data` (default projects view)
- `/data`, `/data/partners`, `/data/steerco`, `/data/contacts` - iframe-backed data tabs
- `/partners` - standalone D3/GSAP force-graph visualization (dynamic imports for client libs)
- `/ecosystem`, `/financing`, `/impact`, `/steerco` - additional standalone pages
- `/login`, `/auth` (POST), `/logout` - auth flow
- `trailingSlash: true` in next.config

**Client/Server split**: Dashboard layout is a server component that checks auth, then wraps children in `TabProvider` and `ClientOnly`. Only use `"use client"` for truly interactive components. Tab state (grid/list view) managed via `TabContext`.

**Partner data**: Loaded from `public/data/partners.json` via `src/lib/data/partners.ts` (server-side fs read). Types in `src/types/index.ts`.

**Path alias**: `@/*` maps to `./src/*`

### Styling

- Tailwind CSS v4 with `@theme` directive in `globals.css` — use this for custom colors/tokens, NOT the v3 `theme.extend` pattern
- Brand color: `crafd-yellow` (#f1b434) defined as `--color-crafd-yellow` in `@theme` block
- Custom font: Qanelas (Black/ExtraBold/Heavy) via `@font-face`, class `font-qanelas`
- Body font: Roboto via `next/font/google`
- shadcn/ui CSS variables (oklch) in `:root`
- Design: left-aligned, clear visual hierarchy, `crafd-yellow` + black palette

### Conventions

- PascalCase for component files (`MyComponent.tsx`), name similar components so they sort together
- kebab-case or snake_case for directories and non-component files
- shadcn/ui primitives live in `components/ui/` — never edit directly, compose custom components on top
- Prefer server components; client components only for interactivity
- No `any` types; use generics and explicit prop types
- Understand the existing page/API structure before making changes — avoid creating parallel infrastructure
- Dynamic import heavy client libs (gsap, d3) only in client components

### Environment Variables

See `.env.example`: `NEXT_PUBLIC_AIRTABLE_*_URL` (iframe embeds), `SITE_USERNAME`/`SITE_PASSWORD` (auth), `AIRTABLE_API_KEY` (data sync), `BASE_PATH` (optional, non-root deployments).

### Python

- use `uv add`