import { Tenant, ComparisonData } from "../types";
import { getRiskTier } from "../utils";
import { RosterEntry } from "./roster-parser";

interface LedgerEntry {
  unit: string;
  name: string;
  rent: number;
  transactions: { date: string; description: string; charges: number; payments: number; balance: number }[];
  aging: { current: number; days30: number; days60: number; days90: number };
  amountDue: number;
}

function findLastPayment(transactions: { date: string; payments: number }[]) {
  let lastPaymentDate: string | null = null;
  let lastPaymentAmount = 0;
  for (const txn of [...transactions].reverse()) {
    if (txn.payments > 0) {
      lastPaymentDate = txn.date;
      lastPaymentAmount = txn.payments;
      break;
    }
  }
  return { lastPaymentDate, lastPaymentAmount };
}

function parseName(fullName: string) {
  if (!fullName) return { firstName: "", lastName: "" };
  // Try "Last, First" format
  if (fullName.includes(",")) {
    const [last, ...rest] = fullName.split(",").map((s) => s.trim());
    return { firstName: rest.join(" "), lastName: last };
  }
  // Try "First Last" format
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  }
  return { firstName: fullName.trim(), lastName: "" };
}

export function mergeTenantData(
  arData: Partial<Tenant>[],
  ledgerData: Map<string, LedgerEntry>,
  rosterData: RosterEntry[]
): Tenant[] {
  const rosterMap = new Map<string, RosterEntry>();
  for (const entry of rosterData) {
    rosterMap.set(entry.unit.toUpperCase().trim(), entry);
  }

  // Track which ledger/roster units we've already handled via AR data
  const processedUnits = new Set<string>();

  // 1) Build tenants from AR data (primary source), enriching with ledger + roster
  const tenantsFromAR: Tenant[] = arData.map((ar, index) => {
    const unit = (ar.unit || "").toUpperCase();
    if (unit) processedUnits.add(unit);

    const ledger = ledgerData.get(unit) || ledgerData.get(ar.unit || "");
    const roster = rosterMap.get(unit);
    const transactions = ledger?.transactions || ar.transactions || [];
    const { lastPaymentDate, lastPaymentAmount } = findLastPayment(transactions);

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
      flaggedForLegal: false,
      paymentPlan: false,
      riskTier: "current",
    };

    if (!tenant.firstName && !tenant.lastName && roster?.applicant) {
      const { firstName, lastName } = parseName(roster.applicant);
      tenant.firstName = firstName;
      tenant.lastName = lastName;
    }
    if (!tenant.firstName && !tenant.lastName && ledger?.name) {
      const { firstName, lastName } = parseName(ledger.name);
      tenant.firstName = firstName;
      tenant.lastName = lastName;
    }

    tenant.riskTier = getRiskTier(tenant);
    return tenant;
  });

  // 2) Build tenants from ledger data that weren't in AR
  const tenantsFromLedger: Tenant[] = [];
  let ledgerIdx = 0;
  for (const [key, ledger] of Array.from(ledgerData.entries())) {
    const unitKey = key.toUpperCase();
    if (processedUnits.has(unitKey)) continue;
    processedUnits.add(unitKey);

    const roster = rosterMap.get(unitKey);
    const { lastPaymentDate, lastPaymentAmount } = findLastPayment(ledger.transactions);
    const { firstName, lastName } = ledger.name
      ? parseName(ledger.name)
      : roster?.applicant
      ? parseName(roster.applicant)
      : { firstName: "", lastName: "" };

    const balance = ledger.amountDue || (ledger.aging.current + ledger.aging.days30 + ledger.aging.days60 + ledger.aging.days90);

    const tenant: Tenant = {
      id: `ledger-${ledgerIdx++}`,
      unit: ledger.unit,
      firstName,
      lastName,
      rent: ledger.rent || roster?.rent || 0,
      phone: roster?.phone || "",
      email: roster?.email || "",
      balance,
      current: ledger.aging.current,
      days30: ledger.aging.days30,
      days60: ledger.aging.days60,
      days90: ledger.aging.days90,
      over90: 0,
      transactions: ledger.transactions,
      lastPaymentDate,
      lastPaymentAmount,
      flaggedForLegal: false,
      paymentPlan: false,
      riskTier: "current",
    };

    tenant.riskTier = getRiskTier(tenant);
    tenantsFromLedger.push(tenant);
  }

  // 3) Build tenants from roster that weren't in AR or ledger
  const tenantsFromRoster: Tenant[] = [];
  let rosterIdx = 0;
  for (const entry of rosterData) {
    const unitKey = entry.unit.toUpperCase();
    if (processedUnits.has(unitKey)) continue;
    processedUnits.add(unitKey);

    const { firstName, lastName } = parseName(entry.applicant);
    tenantsFromRoster.push({
      id: `roster-${rosterIdx++}`,
      unit: entry.unit,
      firstName,
      lastName,
      rent: entry.rent,
      phone: entry.phone,
      email: entry.email,
      balance: 0,
      current: 0,
      days30: 0,
      days60: 0,
      days90: 0,
      over90: 0,
      transactions: [],
      lastPaymentDate: null,
      lastPaymentAmount: 0,
      flaggedForLegal: false,
      paymentPlan: false,
      riskTier: "current",
    });
  }

  return [...tenantsFromAR, ...tenantsFromLedger, ...tenantsFromRoster];
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
