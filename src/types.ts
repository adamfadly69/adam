/**
 * Types and interfaces for the Lospollos CPA Team Tracker system
 */

export interface AdminSettings {
  adminPassword: string;
  globalSmartlink: string;
  customDomain?: string;
}

export interface TeamMember {
  id: string;
  username: string;
  password: string;
  name: string;
  createdAt: string;
}

export interface ClickLog {
  id: string;
  teamId: string; // username of the team member
  subId: string;  // secondary sub-ID (e.g. campaign label from team member)
  ip: string;
  userAgent: string;
  country: string;
  timestamp: string;
}

export interface ConversionLog {
  id: string;
  teamId: string; // username of the team member
  subId: string;  // secondary sub-ID (campaign label)
  payout: number; // payout value
  status: string; // e.g. "approved", "lead", "pending"
  timestamp: string;
  rawParams: string; // For tracing/debugging
}

export interface DashboardStats {
  totalClicks: number;
  totalConversions: number;
  totalPayout: number;
  conversionRate: number;
  clicksToday: number;
  conversionsToday: number;
  payoutToday: number;
}

export interface TeamStats {
  username: string;
  name: string;
  totalClicks: number;
  totalConversions: number;
  totalPayout: number;
  conversionRate: number;
}

export interface SubIdStats {
  subId: string;
  clicks: number;
  conversions: number;
  payout: number;
  conversionRate: number;
}

export interface Shortlink {
  id: string;
  code: string;
  teamId: string;
  subId: string;
  clicks: number;
  createdAt: string;
}

