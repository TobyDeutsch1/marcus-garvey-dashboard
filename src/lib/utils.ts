import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { RiskTier, Tenant } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getRiskTier(tenant: Pick<Tenant, "over90" | "days90" | "days60" | "days30" | "balance" | "flaggedForLegal">): RiskTier {
  if (tenant.flaggedForLegal) return "legal-review";
  if (tenant.over90 > 0) return "at-risk";
  if (tenant.days60 > 0 || tenant.days90 > 0) return "watch";
  return "current";
}

export function getRowColor(tier: RiskTier): string {
  switch (tier) {
    case "current":
      return "bg-green-50 hover:bg-green-100";
    case "watch":
      return "bg-yellow-50 hover:bg-yellow-100";
    case "at-risk":
      return "bg-orange-50 hover:bg-orange-100";
    case "legal-review":
      return "bg-red-50 hover:bg-red-100";
  }
}

export function getTierBadgeColor(tier: RiskTier): string {
  switch (tier) {
    case "current":
      return "bg-green-100 text-green-800";
    case "watch":
      return "bg-yellow-100 text-yellow-800";
    case "at-risk":
      return "bg-orange-100 text-orange-800";
    case "legal-review":
      return "bg-red-100 text-red-800";
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function estimateAvgDaysDelinquent(tenants: Tenant[]): number {
  const delinquent = tenants.filter((t) => t.balance > 0);
  if (delinquent.length === 0) return 0;
  const totalDays = delinquent.reduce((sum, t) => {
    if (t.over90 > 0) return sum + 90;
    if (t.days90 > 0) return sum + 75;
    if (t.days60 > 0) return sum + 45;
    if (t.days30 > 0) return sum + 15;
    if (t.current > 0) return sum + 7;
    return sum;
  }, 0);
  return Math.round(totalDays / delinquent.length);
}
