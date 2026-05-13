export interface CrafdProject {
  airtable_id: string;
  project_short_title: string | null;
  project_label: string | null;
  full_title: string | null;
  project_blurb: string | null;
  project_url: string | null;
  grant_size: number | string | null;
  project_status: string | null;
  duration_months: string | null;
  project_coverage: string | null;
  linked_lead_org?: string[] | null;
  linked_supporting_org?: string[] | null;
}

export interface Partner {
  airtable_id?: string | null;
  org_short_name: string;
  org_full_name: string;
  crafd_connection: string[];
  org_type?: string | null;
  white_logo_path?: string | null;
  thumb_logo_path?: string | null;
  color_logo_path?: string | null;
  relational_project?: string[];
  org_url?: string | null;
  total_grant_size?: number | string | null;
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
