export interface CrafdProject {
  project_short_title: string;   // join key — matches relational_project tokens
  project_label: string | null;  // "Org: ProjectName" concise display
  full_title: string | null;     // long descriptive title
  project_blurb: string | null;
  project_url: string | null;
  grant_size: string | null;
  project_status: string | null;
  duration_months: string | null;
  project_coverage: string | null;
}

export interface Partner {
  org_short_name: string;
  org_full_name: string;
  crafd_connection: string;
  org_logo_white: string | null;
  logo_path: string | null;
  relational_project?: string;
}

export type PartnerConnectionType =
  | "Collaborating Partner"
  | "Implementing Partner"
  | "Lead Project Partner"
  | "Administrative Partner"
  | "MoU Signatory/UN Partner"
  | "Complementary Donor"
  | "Donor Partner"
  | "CRAF'd";

// Utility types for data visualization
export interface PartnerStats {
  total: number;
  withLogos: number;
  withoutLogos: number;
  byConnectionType: ConnectionTypeCount[];
}

export interface ConnectionTypeCount {
  type: string;
  count: number;
}
