/**
 * Airtable iframe configuration
 * Add your Airtable iframe embed URLs here
 * Format: https://airtable.com/embed/YOUR_SHARE_ID
 */

export const AIRTABLE_TABS = [
  {
    value: "overview",
    label: "Overview",
    iframeUrl: process.env.NEXT_PUBLIC_AIRTABLE_1_URL || "",
  },
  {
    value: "incoming",
    label: "Incoming Funds",
    iframeUrl: process.env.NEXT_PUBLIC_AIRTABLE_2_URL || "",
  },
  {
    value: "outgoing",
    label: "Outgoing Funds",
    iframeUrl: process.env.NEXT_PUBLIC_AIRTABLE_3_URL || "",
  },
  {
    value: "liquidity",
    label: "Net Liquidity",
    iframeUrl: process.env.NEXT_PUBLIC_AIRTABLE_4_URL || "",
  },
];
