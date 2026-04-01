export interface Transaction {
  date: string;
  description: string;
  charges: number;
  payments: number;
  balance: number;
}

export interface Tenant {
  id: string;
  unit: string;
  firstName: string;
  lastName: string;
  rent: number;
  phone: string;
  email: string;
  balance: number;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  transactions: Transaction[];
  lastPaymentDate: string | null;
  lastPaymentAmount: number;
  flaggedForLegal: boolean;
  paymentPlan: boolean;
  riskTier: RiskTier;
}

export type RiskTier = "current" | "watch" | "at-risk" | "legal-review";

export interface ARSummary {
  totalAR: number;
  tenantsWithBalances: number;
  collectedThisMonth: number;
  avgDaysDelinquent: number;
}

export interface ComparisonData {
  tenantId: string;
  unit: string;
  name: string;
  previousBalance: number;
  currentBalance: number;
  delta: number;
  previousCurrent: number;
  currentCurrent: number;
  previous30: number;
  current30: number;
  previous60: number;
  current60: number;
  previous90: number;
  current90: number;
  previousOver90: number;
  currentOver90: number;
}

export interface Property {
  code: string;
  name: string;
  tenants: Tenant[];
}

export type SortField =
  | "unit"
  | "name"
  | "balance"
  | "current"
  | "days30"
  | "days60"
  | "days90"
  | "over90"
  | "lastPaymentDate";

export type SortDirection = "asc" | "desc";
