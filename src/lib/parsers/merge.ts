import { Tenant, ComparisonData } from "../types";
import { getRiskTier } from "../utils";
import { RosterEntry } from "./roster-parser";

export function mergeTenantData(
  arData: Partial<Tenant>[],
  ledgerData: Map<string, { unit: string; name: string; rent: number; transactions: { date: string; description: string; charges: number; payments: number; balance: number }[]; aging: { current: number; days30: number; days60: number; days90: number }; amountDue: number }>,
  rosterData: RosterEntry[]
): Tenant[] {
  const rosterMap = new Map<string, RosterEntry>();
  for (const entry of rosterData) {
    rosterMap.set(entry.unit.toUpperCase(), entry);
  }

  const tenants: Tenant[] = arData.map((ar, index) => {
    const unit = ar.unit?.toUpperCase() || "";
    const ledger = ledgerData.get(unit) || ledgerData.get(ar.unit || "");
    const roster = rosterMap.get(unit);

    // Find last payment from transactions
    let lastPaymentDate: string | null = null;
    let lastPaymentAmount = 0;
    const transactions = ledger?.transactions || ar.transactions || [];

    for (const txn of [...transactions].reverse()) {
      if (txn.payments > 0) {
        lastPaymentDate = txn.date;
        lastPaymentAmount = txn.payments;
        break;
      }
    }

    const tenant: Tenant = {
      id: ar.id || `tenant-${index}`,
      unit: ar.unit || ledger?.unit || roster?.unit || "",
      firstName: ar.firstName || "",
      lastName: ar.lastName || "",
      rent: ledger?.rent || roster?.rent || ar.rent || 0,
      phone: roster?.phone || "",
      email: roster?.email || "",
      balance: ar.balance || ledger?.amountDue || 0,
      current: ar.current || ledger?.aging.current || 0,
      days30: ar.days30 || ledger?.aging.days30 || 0,
      days60: ar.days60 || ledger?.aging.days60 || 0,
      days90: ar.days90 || ledger?.aging.days90 || 0,
      over90: ar.over90 || 0,
      transactions,
      lastPaymentDate,
      lastPaymentAmount,
      flaggedForLegal: ar.flaggedForLegal || false,
      paymentPlan: ar.paymentPlan || false,
      riskTier: "current",
    };

    // If roster has a name and AR doesn't, use roster
    if (!tenant.firstName && !tenant.lastName && roster?.applicant) {
      const parts = roster.applicant.split(/[,\s]+/);
      if (parts.length >= 2) {
        tenant.lastName = parts[0];
        tenant.firstName = parts.slice(1).join(" ");
      } else {
        tenant.firstName = roster.applicant;
      }
    }

    tenant.riskTier = getRiskTier(tenant);
    return tenant;
  });

  return tenants;
}

export function buildComparisonData(
  currentTenants: Tenant[],
  previousTenants: Tenant[]
): ComparisonData[] {
  const prevMap = new Map<string, Tenant>();
  for (const t of previousTenants) {
    prevMap.set(t.unit.toUpperCase(), t);
  }

  return currentTenants
    .map((curr) => {
      const prev = prevMap.get(curr.unit.toUpperCase());
      if (!prev) return null;
      return {
        tenantId: curr.id,
        unit: curr.unit,
        name: `${curr.lastName}, ${curr.firstName}`,
        previousBalance: prev.balance,
        currentBalance: curr.balance,
        delta: curr.balance - prev.balance,
        previousCurrent: prev.current,
        currentCurrent: curr.current,
        previous30: prev.days30,
        current30: curr.days30,
        previous60: prev.days60,
        current60: curr.days60,
        previous90: prev.days90,
        current90: curr.days90,
        previousOver90: prev.over90,
        currentOver90: curr.over90,
      };
    })
    .filter((item): item is ComparisonData => item !== null);
}
