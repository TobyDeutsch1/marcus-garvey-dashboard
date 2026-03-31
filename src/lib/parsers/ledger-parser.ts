import { Transaction } from "../types";

interface LedgerData {
  unit: string;
  name: string;
  rent: number;
  phone: string;
  residentCode: string;
  transactions: Transaction[];
  aging: {
    current: number;
    days30: number;
    days60: number;
    days90: number;
    over90: number;
  };
  amountDue: number;
}

function toNum(s: string): number {
  const cleaned = s.replace(/[$,\s()]/g, "").trim();
  if (!cleaned || cleaned === "-") return 0;
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function toAbsNum(s: string): number {
  return Math.abs(toNum(s));
}

/** Group PDF text items into lines sorted top-to-bottom, left-to-right */
function itemsToLines(items: Array<{ str: string; transform: number[] }>): string[] {
  if (!items.length) return [];

  const sorted = [...items]
    .filter((i) => i.str.trim())
    .sort((a, b) => {
      const dy = b.transform[5] - a.transform[5];
      if (Math.abs(dy) > 3) return dy;
      return a.transform[4] - b.transform[4];
    });

  const lines: string[] = [];
  let curLine = sorted[0].str;
  let lastY = sorted[0].transform[5];

  for (let i = 1; i < sorted.length; i++) {
    const y = sorted[i].transform[5];
    if (Math.abs(y - lastY) > 5) {
      lines.push(curLine.trim());
      curLine = sorted[i].str;
      lastY = y;
    } else {
      curLine += " " + sorted[i].str;
    }
  }
  if (curLine.trim()) lines.push(curLine.trim());
  return lines;
}

/**
 * Parse a Yardi Resident Ledger PDF.
 *
 * Each page has a known structure:
 *   Page : NN Resident Ledger
 *   Date: MM/DD/YY
 *   Resident Code: t0005754
 *   Property: margar
 *   Unit: 14A
 *   Rashad Hicks Status: Current
 *   212 West 124th Street # 14A Current Rent: $788.00
 *   New York, NY, 10027 Deposit: $788.00
 *   Move In Date: 04/01/25
 *   ...
 *   Tel# (H): (347) 519-0143
 *   Date Description Charges Payments Balance
 *   Balance forward 0.00
 *   ... transaction lines ...
 *   Current 30 Days 60 Days 90 Days Amount Due
 *   788.00 788.00 2554.80 0.00 4130.80
 */
export async function parseLedgerPDF(file: File): Promise<Map<string, LedgerData>> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const tenantMap = new Map<string, LedgerData>();

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{ str: string; transform: number[] }>;
    const lines = itemsToLines(items);

    let unit = "";
    let name = "";
    let rent = 0;
    let phone = "";
    let residentCode = "";
    const transactions: Transaction[] = [];
    const aging = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    let amountDue = 0;

    // Track parser state
    let inTransactionSection = false;
    let agingHeaderIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // ── Unit: 14A ──
      const unitMatch = line.match(/^\s*Unit\s*[:#]?\s*([A-Z0-9][A-Z0-9\-]*)\s*$/i);
      if (unitMatch && !unit) {
        unit = unitMatch[1].trim();
        continue;
      }

      // ── Resident Code: t0005754 ──
      const codeMatch = line.match(/Resident\s*Code\s*[:#]?\s*(t\d+)/i);
      if (codeMatch) {
        residentCode = codeMatch[1].toLowerCase();
        continue;
      }

      // ── Name line: "Rashad Hicks Status: Current" or "Hicks, Rashad Status: Current" ──
      const statusMatch = line.match(/^(.+?)\s+Status\s*:\s*(Current|Past|Evicted|Notice|Future)/i);
      if (statusMatch && !name) {
        const rawName = statusMatch[1].trim();
        // Make sure it's not a header line or property line
        if (rawName.length > 1 && !rawName.match(/^(Page|Date|Property|Unit|Resident)/i)) {
          name = rawName;
        }
        continue;
      }

      // ── Current Rent: $788.00 ──
      const rentMatch = line.match(/Current\s+Rent\s*[:#]?\s*\$?([\d,]+\.?\d*)/i);
      if (rentMatch && !rent) {
        rent = toAbsNum(rentMatch[1]);
        // Don't continue — same line may have address info
      }

      // ── Tel# (H): (347) 519-0143 ──
      const phoneMatch = line.match(/Tel#\s*\([HCM]\)\s*[:#]?\s*([\d\(\)\-\s]+)/i);
      if (phoneMatch && !phone) {
        phone = phoneMatch[1].trim();
      }

      // ── Transaction header row: "Date Description Charges Payments Balance" ──
      if (/^\s*Date\s+Description\s+Charges\s+Payments\s+Balance/i.test(line)) {
        inTransactionSection = true;
        continue;
      }

      // ── Aging header row: "Current 30 Days 60 Days 90 Days Amount Due" ──
      if (/Current\s+30\s*Days?\s+60\s*Days?\s+90\s*Days?\s+Amount\s*Due/i.test(line)) {
        inTransactionSection = false;
        agingHeaderIdx = i;
        continue;
      }

      // ── Aging values row (immediately after aging header) ──
      if (agingHeaderIdx >= 0 && i === agingHeaderIdx + 1) {
        const nums = Array.from(line.matchAll(/-?[\d,]+\.?\d*/g))
          .map((m) => m[0])
          .filter((s) => s.trim());
        if (nums.length >= 4) {
          aging.current = toAbsNum(nums[0]);
          aging.days30 = toAbsNum(nums[1]);
          aging.days60 = toAbsNum(nums[2]);
          aging.days90 = toAbsNum(nums[3]);
          if (nums.length >= 5) {
            amountDue = toAbsNum(nums[nums.length - 1]);
          }
        }
        continue;
      }

      // ── Transaction lines (between header and aging) ──
      if (inTransactionSection) {
        // "Balance forward" line
        const bfMatch = line.match(/Balance\s+forward\s+([\d,\-]+\.?\d*)/i);
        if (bfMatch) {
          // Skip or record as first transaction
          continue;
        }

        // Transaction lines start with a date: MM/DD/YY or MM/DD/YYYY
        const dateRe = /^(\d{1,2}\/\d{1,2}\/\d{2,4})/;
        const dateMatch = line.match(dateRe);
        if (!dateMatch) continue;

        const date = dateMatch[1];
        // Everything after the date up to the numbers is the description
        const afterDate = line.slice(dateMatch[0].length).trim();

        // Extract all monetary values from the line
        const moneyMatches = Array.from(afterDate.matchAll(/([\d,]+\.?\d{0,2})(?=\s|$)/g));
        if (moneyMatches.length < 1) continue;

        const nums = moneyMatches.map((m) => toNum(m[1]));

        // Extract description (text before the first number)
        const firstNumIdx = afterDate.indexOf(moneyMatches[0][0]);
        const desc = afterDate.slice(0, firstNumIdx).replace(/\s+/g, " ").trim();

        // Yardi format: Description Charges Payments Balance
        // Some lines have 3 numbers (charge, payment, balance)
        // Some have 2 numbers (either charge+balance or payment+balance)
        let charges = 0;
        let payments = 0;
        let balance = 0;

        if (nums.length >= 3) {
          charges = nums[nums.length - 3];
          payments = nums[nums.length - 2];
          balance = nums[nums.length - 1];
        } else if (nums.length === 2) {
          // Could be charges+balance or payments+balance
          // Heuristic: if description contains payment-like words, second-to-last is payment
          const isPayment = /payment|chk#|check|deposit|credit|debit|card/i.test(desc);
          if (isPayment) {
            payments = nums[0];
          } else {
            charges = nums[0];
          }
          balance = nums[1];
        } else if (nums.length === 1) {
          balance = nums[0];
        }

        transactions.push({
          date,
          description: desc || "Transaction",
          charges,
          payments,
          balance,
        });
      }
    }

    // Fallback: if no aging header found, try to find aging from last lines
    if (agingHeaderIdx < 0) {
      // Look for "Amount Due" on any line
      for (const line of lines) {
        const adMatch = line.match(/Amount\s*Due\s*[:#]?\s*\$?([\d,]+\.?\d*)/i);
        if (adMatch) {
          amountDue = toAbsNum(adMatch[1]);
          break;
        }
      }
    }

    // Compute amount due from aging if not found
    if (!amountDue && (aging.current || aging.days30 || aging.days60 || aging.days90 || aging.over90)) {
      amountDue = aging.current + aging.days30 + aging.days60 + aging.days90 + aging.over90;
    }

    // If no unit found, use page number
    if (!unit) unit = `Page${pageNum}`;

    // Normalize unit key
    const unitKey = unit.toUpperCase().trim();
    tenantMap.set(unitKey, {
      unit,
      name,
      rent,
      phone,
      residentCode,
      transactions,
      aging,
      amountDue,
    });
  }

  return tenantMap;
}
