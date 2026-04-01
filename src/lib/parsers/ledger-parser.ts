import { Transaction } from "../types";

export interface LedgerData {
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

export interface LedgerParseResult {
  tenants: Map<string, LedgerData>;
  propertyCode: string;
}

function toNum(s: string): number {
  const cleaned = s.replace(/[$,\s]/g, "").replace(/\(([^)]+)\)/, "-$1").trim();
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

// ── Heuristic helpers ──

/** Words that indicate a line is a header/label, not a tenant name */
const HEADER_WORDS = /^(page|date|property|unit|building|site|resident|tenant|ledger|report|balance|total|amount|current|phone|tel|deposit|move|due|description|charges|payments)/i;

/** Detect if a line looks like a "Key: Value" pair */
function extractKeyValue(line: string): { key: string; value: string } | null {
  // Match patterns like "Some Label: some value" or "Some Label : some value"
  const m = line.match(/^(.+?)\s*:\s+(.+)$/);
  if (m && m[1].length < 40) return { key: m[1].trim(), value: m[2].trim() };
  return null;
}

/** Check if a string looks like a unit identifier (1-6 alphanumeric chars) */
function looksLikeUnit(s: string): boolean {
  return /^[A-Z0-9][A-Z0-9\-]{0,5}$/i.test(s.trim());
}

/** Check if a string looks like a phone number */
function looksLikePhone(s: string): boolean {
  const digits = s.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

/** Check if a string looks like a person's name (2+ capitalized words, no numbers) */
function looksLikeName(s: string): boolean {
  const words = s.trim().split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  // Must have at least 2 words that start with a capital letter and are all alpha
  const nameWords = words.filter((w) => /^[A-Z][a-zA-Z'\-]+$/.test(w));
  return nameWords.length >= 2;
}

/** Detect a transaction table header row — needs ≥3 of these concepts */
function isTransactionHeader(line: string): boolean {
  const lower = line.toLowerCase();
  let score = 0;
  if (/\bdate\b/.test(lower)) score++;
  if (/\b(description|memo|detail|type|reference)\b/.test(lower)) score++;
  if (/\b(charges?|debits?|amount)\b/.test(lower)) score++;
  if (/\b(payments?|credits?|received)\b/.test(lower)) score++;
  if (/\bbalance\b/.test(lower)) score++;
  return score >= 3;
}

/** Detect an aging summary header row */
function isAgingHeader(line: string): boolean {
  const lower = line.toLowerCase();
  // Look for a line that mentions aging periods
  const hasCurrent = /\bcurrent\b/.test(lower);
  const has30 = /\b30\b/.test(lower);
  const has60 = /\b60\b/.test(lower);
  const has90 = /\b90\b/.test(lower);
  const hasDue = /\b(due|total|owed|outstanding)\b/.test(lower);
  // Need current + at least two aging buckets
  const agingCount = [hasCurrent, has30, has60, has90].filter(Boolean).length;
  return agingCount >= 3 || (agingCount >= 2 && hasDue);
}

/** Extract all numbers from a line */
function extractNumbers(line: string): string[] {
  return Array.from(line.matchAll(/-?[\d,]+\.?\d*/g))
    .map((m) => m[0])
    .filter((s) => s.trim() && s !== "0");
}

/**
 * Intelligently parse a Yardi-style Resident Ledger PDF.
 *
 * Uses heuristics rather than exact field matching:
 * 1. Scan for key-value pairs (Label: Value)
 * 2. Detect transaction table header and parse rows
 * 3. Detect aging summary and extract values
 * 4. Detect tenant name from Status line or name-like patterns
 */
export async function parseLedgerPDF(file: File): Promise<LedgerParseResult> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const tenantMap = new Map<string, LedgerData>();
  let propertyCode = "";

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

    let inTransactionSection = false;
    let agingHeaderIdx = -1;

    // ── Phase 1: Key-Value scan + heuristic detection ──
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip empty lines
      if (!line.trim()) continue;

      // ── Check for Status line (strongest name signal) ──
      // Pattern: "Rashad Hicks Status: Current" or "Smith, John Status: Past"
      const statusMatch = line.match(/^(.+?)\s+Status\s*:\s*\w+/i);
      if (statusMatch && !name) {
        const candidate = statusMatch[1].trim();
        if (candidate.length > 1 && !HEADER_WORDS.test(candidate)) {
          name = candidate;
        }
      }

      // ── Detect transaction table header ──
      if (isTransactionHeader(line) && !inTransactionSection) {
        inTransactionSection = true;
        continue;
      }

      // ── Detect aging summary header ──
      if (isAgingHeader(line) && !inTransactionSection) {
        agingHeaderIdx = i;
        continue;
      }
      // Also detect aging header when in transaction section (signals end of transactions)
      if (isAgingHeader(line) && inTransactionSection) {
        inTransactionSection = false;
        agingHeaderIdx = i;
        continue;
      }

      // ── Aging values row (next row of numbers after aging header) ──
      if (agingHeaderIdx >= 0 && i > agingHeaderIdx && i <= agingHeaderIdx + 2) {
        const nums = extractNumbers(line);
        if (nums.length >= 3) {
          aging.current = toAbsNum(nums[0]);
          aging.days30 = nums.length > 1 ? toAbsNum(nums[1]) : 0;
          aging.days60 = nums.length > 2 ? toAbsNum(nums[2]) : 0;
          aging.days90 = nums.length > 3 ? toAbsNum(nums[3]) : 0;
          aging.over90 = nums.length > 4 ? toAbsNum(nums[4]) : 0;
          // Last number is often "Amount Due" / total
          if (nums.length >= 5) {
            amountDue = toAbsNum(nums[nums.length - 1]);
          }
          agingHeaderIdx = -1; // Done with aging
          continue;
        }
      }

      // ── Transaction lines ──
      if (inTransactionSection) {
        // Skip "Balance forward" type lines
        if (/balance\s+forward/i.test(line)) continue;

        // Transaction lines start with a date
        const dateMatch = line.match(/^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
        if (!dateMatch) continue;

        const date = dateMatch[1];
        const afterDate = line.slice(dateMatch[0].length).trim();

        // Extract monetary values
        const moneyMatches = Array.from(afterDate.matchAll(/([\d,]+\.?\d{0,2})(?=\s|$)/g));
        if (moneyMatches.length < 1) continue;

        const nums = moneyMatches.map((m) => toNum(m[1]));
        const firstNumIdx = afterDate.indexOf(moneyMatches[0][0]);
        const desc = afterDate.slice(0, firstNumIdx).replace(/\s+/g, " ").trim();

        let charges = 0;
        let payments = 0;
        let balance = 0;

        if (nums.length >= 3) {
          charges = nums[nums.length - 3];
          payments = nums[nums.length - 2];
          balance = nums[nums.length - 1];
        } else if (nums.length === 2) {
          const isPayment = /payment|chk#|check|deposit|credit|debit|card|transfer/i.test(desc);
          if (isPayment) {
            payments = nums[0];
          } else {
            charges = nums[0];
          }
          balance = nums[1];
        } else if (nums.length === 1) {
          balance = nums[0];
        }

        transactions.push({ date, description: desc || "Transaction", charges, payments, balance });
        continue;
      }

      // ── Key-Value pair extraction ──
      const kv = extractKeyValue(line);
      if (kv) {
        const keyLower = kv.key.toLowerCase();

        // Unit detection
        if (/\b(unit|apt|suite|space|room)\b/i.test(kv.key) && !unit) {
          const unitVal = kv.value.split(/\s/)[0]; // Take first word
          if (looksLikeUnit(unitVal)) {
            unit = unitVal.trim();
          }
        }

        // Property detection
        if (/\b(property|building|site|complex)\b/i.test(kv.key) && !propertyCode) {
          propertyCode = kv.value.split(/\s/)[0].trim();
        }

        // Resident code / ID
        if (/\b(code|id)\b/i.test(keyLower) && /\b(resident|tenant|account)\b/i.test(keyLower)) {
          residentCode = kv.value.trim().toLowerCase();
        }

        // Rent detection
        if (/\brent\b/i.test(kv.key)) {
          const rentVal = toAbsNum(kv.value);
          if (rentVal > 0 && !rent) rent = rentVal;
        }

        // Phone detection
        if (/\b(tel|phone|cell|mobile)\b/i.test(kv.key)) {
          if (looksLikePhone(kv.value) && !phone) {
            phone = kv.value.trim();
          }
        }

        continue;
      }

      // ── Inline rent detection (e.g., "Current Rent: $788.00" on a line with other text) ──
      if (!rent) {
        const rentInline = line.match(/\bRent\s*[:#]\s*\$?([\d,]+\.?\d*)/i);
        if (rentInline) rent = toAbsNum(rentInline[1]);
      }

      // ── Inline phone detection ──
      if (!phone) {
        const phoneInline = line.match(/(?:Tel|Phone|Cell|Mobile)\s*#?\s*(?:\([A-Z]\))?\s*[:#]?\s*([\d\(\)\-\.\s]{7,})/i);
        if (phoneInline) phone = phoneInline[1].trim();
      }

      // ── Fallback name detection: line that looks like a person name in the header area ──
      if (!name && !inTransactionSection && i < 15) {
        // Only look in the first ~15 lines (header section)
        const stripped = line.replace(/\b(Status|Current|Past|Evicted|Notice|Future)\b.*/i, "").trim();
        if (looksLikeName(stripped) && !HEADER_WORDS.test(stripped)) {
          name = stripped;
        }
      }
    }

    // ── Compute fallback values ──
    if (!amountDue && (aging.current || aging.days30 || aging.days60 || aging.days90 || aging.over90)) {
      amountDue = aging.current + aging.days30 + aging.days60 + aging.days90 + aging.over90;
    }

    // If still no amount due, try last transaction balance
    if (!amountDue && transactions.length > 0) {
      amountDue = Math.abs(transactions[transactions.length - 1].balance);
    }

    if (!unit) unit = `Page${pageNum}`;

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

  return { tenants: tenantMap, propertyCode };
}
