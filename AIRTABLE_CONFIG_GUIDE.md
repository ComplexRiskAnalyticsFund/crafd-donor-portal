# Simplified Airtable Portal - Configuration Guide

## What Changed

The application has been restructured to display Airtable iframes instead of custom dashboards:

### Removed
- ❌ All filter components (date ranges, earmark filters)
- ❌ Refresh data buttons
- ❌ Custom dashboard pages (Overall, Incoming, Outgoing, Liquidity, Data)
- ❌ HeaderFilters component
- ❌ Dynamic page titles in the header
- ❌ Data fetching logic (no more PostgreSQL dependency for display)
- ❌ Complex context providers (FilterContext, DataContext)

### Simplified
- ✅ **Header**: Now shows only logo and "Transparency Portal" title
- ✅ **Main Content**: Single page displaying Airtable iframe
- ✅ **Tab Navigation**: Moved to bottom - controls which Airtable to display
- ✅ **Layout**: Removed authentication/data dependencies from layout

## How to Configure

### Step 1: Get Your Airtable Share Links

For each Airtable base you want to embed:

1. Open your Airtable base
2. Click the **Share** button
3. Click **Shared base link** or **Shared view link**
4. Select **Embed this view**
5. Copy the full iframe `src` URL (format: `https://airtable.com/embed/...`)

### Step 2: Update Configuration

Edit: `src/config/airtable.ts`

Replace the placeholder URLs with your actual Airtable share links:

```typescript
export const AIRTABLE_TABS = [
  {
    value: "overview",
    label: "Overview",
    iframeUrl: "https://airtable.com/embed/YOUR_OVERVIEW_SHARE_ID",
  },
  {
    value: "incoming",
    label: "Incoming Funds",
    iframeUrl: "https://airtable.com/embed/YOUR_INCOMING_SHARE_ID",
  },
  {
    value: "outgoing",
    label: "Outgoing Funds",
    iframeUrl: "https://airtable.com/embed/YOUR_OUTGOING_SHARE_ID",
  },
  {
    value: "liquidity",
    label: "Net Liquidity",
    iframeUrl: "https://airtable.com/embed/YOUR_LIQUIDITY_SHARE_ID",
  },
];
```

### Step 3: Add/Remove Tabs (Optional)

To add a new tab:

```typescript
{
  value: "custom",        // unique identifier
  label: "Custom View",   // displayed label
  iframeUrl: "https://airtable.com/embed/YOUR_CUSTOM_SHARE_ID",
},
```

To remove a tab, simply delete the entire object from the array.

## File Structure

- **`src/config/airtable.ts`** - Configuration file with all tab definitions
- **`src/components/Header.tsx`** - Simplified header (logo + title only)
- **`src/components/UnifiedDashboard.tsx`** - Single page with iframe + tabs
- **`src/app/(dashboard)/layout.tsx`** - Simplified layout (auth only)

## Usage

1. Start dev server: `npm run dev`
2. Navigate to `http://localhost:3000`
3. Login (auth still required)
4. Click tabs at the bottom to switch between Airtable views
5. Interact with Airtables directly in the iframe

## Notes

- Authentication is still required (login page is unchanged)
- All Airtable views will display in the same iframe container
- The bottom tab bar has a black background with yellow highlights for active tabs
- The header remains at the top with the CRAF'd logo and portal title
