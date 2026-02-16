/**
 * Airtable iframe configuration
 * Add your Airtable iframe embed URLs here
 * Format: https://airtable.com/embed/YOUR_SHARE_ID
 */

export const AIRTABLE_TABS = [
  {
    value: "projects",
    label: "Project Data",
    views: [
      {
        value: "grid",
        label: "Grid View",
        iframeUrl: process.env.NEXT_PUBLIC_AIRTABLE_PROJECTS_GRID_URL || "",
      },
      {
        value: "list",
        label: "List View",
        iframeUrl: process.env.NEXT_PUBLIC_AIRTABLE_PROJECTS_LIST_URL || "",
      },
    ],
    defaultView: "grid",
  },
  {
    value: "steerco",
    label: "SteerCo Decisions",
    iframeUrl: process.env.NEXT_PUBLIC_AIRTABLE_STEERCO_URL || "",
  },
  {
    value: "contacts",
    label: "Contacts",
    iframeUrl: process.env.NEXT_PUBLIC_AIRTABLE_CONTACTS_URL || "",
  },
  {
    value: "partners",
    label: "Partner Organizations",
    iframeUrl: process.env.NEXT_PUBLIC_AIRTABLE_PARTNERS_URL || "",
  },
];
