import * as XLSX from "xlsx";
import { Tenant } from "../types";
import { getRiskTier } from "../utils";

function toNum(val: unknown): number {
  const s = String(val ?? "").replace(/[$,\s()]/g, "").trim();
  if (!s || s === "-") return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.abs(n);
}

export function parseARReport(file: File): Promise<Partial<Tenant>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        // Get raw rows with raw values
        const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
          raw: false,
        });

        const tenants: Partial<Tenant>[] = [];
        let current: Partial<Tenant> | null = null;

        // Accumulator for charge rows so we can sum if no explicit totals row
        let acc = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };

        const pushCurrent = () => {
          if (!current) return;
          // If no balance was set from a totals row, use accumulated values
          if (!current.balance) {
            current.current = acc.current;
            current.days30 = acc.days30;
            current.days60 = acc.days60;
            current.days90 = acc.days90;
            current.over90 = acc.over90;
            current.balance =
              acc.current + acc.days30 + acc.days60 + acc.days90 + acc.over90;
          }
          if (current.balance || current.unit) tenants.push(current);
        };

        for (const row of rows) {
          const first = String(row[0] ?? "").trim();
          if (!first) continue;

          // ── Tenant header: (t0005123) Smith, John ──
          const tenantMatch = first.match(/\(\s*(t\d+)\s*\)\s*(.+)/i);
          if (tenantMatch) {
            pushCurrent();
            acc = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
            const id = tenantMatch[1].toLowerCase();
            const namePart = tenantMatch[2].trim();
            let firstName = "";
            let lastName = "";
            if (namePart.includes(",")) {
              const [last, ...rest] = namePart.split(",").map((s) => s.trim());
              lastName = last;
              firstName = rest.join(" ");
            } else {
              const parts = namePart.split(/\s+/);
              lastName = parts[0] || "";
              firstName = parts.slice(1).join(" ");
            }
            current = {
              id,
              firstName,
              lastName,
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

          if (!current) continue;

          // ── Unit extraction: "margar - 14H - Current" ──
          const unitMatch = first.match(/\w+\s*-\s*(\w+)\s*-/i);
          if (unitMatch && !current.unit) {
            current.unit = unitMatch[1];
          }

          // ── Totals / summary row detection ──
          // Matches: "Total", "Totals", "Sub-Total", "Balance Due", blank first cell with numbers
          const isTotalsRow =
            /^(total|sub.?total|balance\s*due)/i.test(first) ||
            (first === "" && row.slice(1).some((c) => toNum(c) > 0));

          if (isTotalsRow) {
            // Find columns with numeric values — try to map to aging buckets
            const nums = row.map((c) => toNum(c)).filter((n) => n > 0);
            // Yardi standard: [charge, owed, current, 0-30, 31-60, 61-90, 90+]
            // We take last 5 as the aging columns
            if (nums.length >= 5) {
              const len = nums.length;
              current.current = nums[len - 5];
              current.days30 = nums[len - 4];
              current.days60 = nums[len - 3];
              current.days90 = nums[len - 2];
              current.over90 = nums[len - 1];
              current.balance =
                current.current +
                current.days30 +
                current.days60 +
                current.days90 +
                current.over90;
            } else if (nums.length > 0) {
              // Fewer columns — treat last value as total balance
              current.balance = nums[nums.length - 1];
            }
            continue;
          }

          // ── Charge row: accumulate aging buckets ──
          // "margar - 14H - Current  charge  owed  current  0-30  31-60  61-90  90+"
          const numCols = row.map((c) => toNum(c));
          const positives = numCols.filter((n) => n > 0);
          if (positives.length >= 5 && !isTotalsRow) {
            // Looks like a data row with aging columns
            // Find the last 5 non-zero positions
            const nonZeroIdxs = numCols
              .map((n, i) => (n > 0 ? i : -1))
              .filter((i) => i >= 0);
            if (nonZeroIdxs.length >= 5) {
              const last5 = nonZeroIdxs.slice(-5);
              acc.current += numCols[last5[0]];
              acc.days30 += numCols[last5[1]];
              acc.days60 += numCols[last5[2]];
              acc.days90 += numCols[last5[3]];
              acc.over90 += numCols[last5[4]];
            }
          }
        }

        pushCurrent();

        resolve(
          tenants.map((t) => ({
            ...t,
            riskTier: getRiskTier(t as Tenant),
          }))
        );
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}
