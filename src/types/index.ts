export interface Partner {
  org_short_name: string;
  org_full_name: string;
  crafd_connection: string;
  org_logo_white: string | null;
  logo_path: string | null;
}

export type PartnerConnectionType =
  | "Collaborating Partner"
  | "Implementing Partner"
  | "Lead Project Partner"
  | "Administrative Partner"
  | "MoU Signatory/UN Partner"
  | "Complementary Donor"
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
