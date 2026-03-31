import * as XLSX from "xlsx";
import { Tenant } from "../types";
import { getRiskTier } from "../utils";

export function parseARReport(file: File): Promise<Partial<Tenant>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

        const tenants: Partial<Tenant>[] = [];
        let currentTenant: Partial<Tenant> | null = null;

        for (const row of rows) {
          const firstCell = String(row[0] || "").trim();

          // Detect tenant header: (t0005xxx) LastName, FirstName
          const tenantMatch = firstCell.match(/\((t\d+)\)\s+(.+)/i);
          if (tenantMatch) {
            if (currentTenant) tenants.push(currentTenant);
            const id = tenantMatch[1];
            const namePart = tenantMatch[2];
            const [lastName, firstName] = namePart.split(",").map((s) => s.trim());
            currentTenant = {
              id,
              firstName: firstName || "",
              lastName: lastName || "",
              balance: 0,
              current: 0,
              days30: 0,
              days60: 0,
              days90: 0,
              over90: 0,
              transactions: [],
              flaggedForLegal: false,
              paymentPlan: false,
              riskTier: "current",
            };
            continue;
          }

          // Detect unit from charge row, e.g. "margar - 14H - Current"
          const chargeMatch = firstCell.match(/\w+\s*-\s*(\w+)\s*-/i);
          if (chargeMatch && currentTenant && !currentTenant.unit) {
            currentTenant.unit = chargeMatch[1];
          }

          // Detect totals row for current tenant
          // Look for rows that start with "Totals" or contain totals data
          if (currentTenant && /total/i.test(firstCell)) {
            // Parse the numeric columns for aging buckets
            const nums = row
              .slice(1)
              .map((c) => parseFloat(String(c).replace(/[$,()]/g, "")) || 0);
            // The totals row typically has: charge, owed, current, 0-30, 31-60, 61-90, over 90
            if (nums.length >= 5) {
              // Try to identify the aging columns
              // Convention: last 5 columns are current, 0-30, 31-60, 61-90, over 90
              const len = nums.length;
              currentTenant.current = Math.abs(nums[len - 5] || 0);
              currentTenant.days30 = Math.abs(nums[len - 4] || 0);
              currentTenant.days60 = Math.abs(nums[len - 3] || 0);
              currentTenant.days90 = Math.abs(nums[len - 2] || 0);
              currentTenant.over90 = Math.abs(nums[len - 1] || 0);
              currentTenant.balance =
                currentTenant.current +
                currentTenant.days30 +
                currentTenant.days60 +
                currentTenant.days90 +
                currentTenant.over90;
            }
          }
        }

        if (currentTenant) tenants.push(currentTenant);

        // Assign risk tiers
        const result = tenants.map((t) => ({
          ...t,
          riskTier: getRiskTier(t as Tenant),
        }));

        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
