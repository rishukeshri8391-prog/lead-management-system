export const LEAD_STATUSES = ["new", "contacted", "qualified", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type VerificationStatus =
  | "unverified"
  | "valid"
  | "invalid"
  | "risky"
  | "unknown";

export interface Lead {
  id: number;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  status: LeadStatus;
  verification_status: VerificationStatus;
  verification_reason: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}