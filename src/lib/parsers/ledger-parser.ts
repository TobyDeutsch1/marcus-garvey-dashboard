import { Transaction } from "../types";

interface LedgerData {
  unit: string;
  name: string;
  rent: number;
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
  const n = parseFloat(s.replace(/[$,\s()]/g, "").trim());
  return isNaN(n) ? 0 : Math.abs(n);
}

/** Group PDF text items into lines sorted top-to-bottom, left-to-right */
function itemsToLines(items: Array<{ str: string; transform: number[] }>): string[] {
  if (!items.length) return [];

  // Sort by descending Y, then ascending X
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
    const fullText = lines.join("\n");

    // ── Extract Unit ──
    // Try explicit "Unit: 14H" or "Unit 14H" patterns first
    let unit = "";
    const unitPatterns = [
      /\bUnit\s*[:#]?\s*([A-Z0-9\-]+)/i,
      /\bApt\.?\s*[:#]?\s*([A-Z0-9\-]+)/i,
      /\bSuite\s*[:#]?\s*([A-Z0-9\-]+)/i,
      // Yardi header often has unit inline: "14H Smith, John"
      /^([A-Z0-9]{1,4}[A-Z0-9\-]*)\s+[A-Z][a-z]/m,
    ];
    for (const pat of unitPatterns) {
      const m = fullText.match(pat);
      if (m?.[1] && m[1].length <= 6) {
        unit = m[1].trim();
        break;
      }
    }
    if (!unit) unit = `Page${pageNum}`;

    // ── Extract Tenant Name ──
    let name = "";
    const namePatterns = [
      /(?:Tenant|Resident|Name)\s*[:#]?\s*([A-Za-z\s,'\-]+?)(?:\n|$)/i,
      /^[A-Z0-9]{1,6}\s+([A-Z][a-zA-Z\-']+,\s*[A-Z][a-zA-Z\-'\s]+)$/m,
    ];
    for (const pat of namePatterns) {
      const m = fullText.match(pat);
      if (m?.[1]?.trim()) {
        name = m[1].trim();
        break;
      }
    }

    // ── Extract Rent ──
    let rent = 0;
    const rentMatch = fullText.match(/(?:Monthly\s+)?Rent\s*[:#]?\s*\$?([\d,]+\.?\d*)/i);
    if (rentMatch) rent = toNum(rentMatch[1]);

    // ── Parse Transactions ──
    const transactions: Transaction[] = [];
    const dateRe = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/;

    for (const line of lines) {
      if (!dateRe.test(line)) continue;
      const dateMatch = line.match(dateRe);
      if (!dateMatch) continue;

      // Extract all numbers from the line
      const numMatches = Array.from(line.matchAll(/-?\$?([\d,]+\.?\d{0,2})/g));
      if (numMatches.length < 2) continue;

      const nums = numMatches.map((m) => toNum(m[0]));

      // Remove the date from the description
      const desc = line
        .replace(dateRe, "")
        .replace(/-?\$?[\d,]+\.?\d*/g, "")
        .replace(/\s+/g, " ")
        .trim();

      // Heuristic: last number is balance, second-to-last is either payment or charge
      const balance = nums[nums.length - 1];
      const payment = nums[nums.length - 2] || 0;
      const charge = nums.length >= 3 ? nums[nums.length - 3] || 0 : 0;

      transactions.push({
        date: dateMatch[1],
        description: desc || "Transaction",
        charges: charge,
        payments: payment,
        balance,
      });
    }

    // ── Extract Aging ──
    const agingPatterns = {
      current: [/Current\s*(?:Balance)?\s*[:#]?\s*\$?([\d,]+\.?\d*)/i],
      days30: [/30\s*(?:Days?|Day)\s*[:#]?\s*\$?([\d,]+\.?\d*)/i, /0[-–]30\s*[:#]?\s*\$?([\d,]+\.?\d*)/i],
      days60: [/60\s*(?:Days?|Day)\s*[:#]?\s*\$?([\d,]+\.?\d*)/i, /31[-–]60\s*[:#]?\s*\$?([\d,]+\.?\d*)/i],
      days90: [/90\s*(?:Days?|Day)\s*[:#]?\s*\$?([\d,]+\.?\d*)/i, /61[-–]90\s*[:#]?\s*\$?([\d,]+\.?\d*)/i],
      over90: [/(?:Over\s*90|90\+)\s*(?:Days?)?\s*[:#]?\s*\$?([\d,]+\.?\d*)/i, /(?:120|180)\s*(?:Days?)[:#]?\s*\$?([\d,]+\.?\d*)/i],
    };

    const aging = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    for (const [key, patterns] of Object.entries(agingPatterns)) {
      for (const pat of patterns) {
        const m = fullText.match(pat);
        if (m?.[1]) {
          (aging as Record<string, number>)[key] = toNum(m[1]);
          break;
        }
      }
    }

    // ── Extract Amount Due ──
    let amountDue = 0;
    const amountDueMatch = fullText.match(/Amount\s*Due\s*[:#]?\s*\$?([\d,]+\.?\d*)/i);
    if (amountDueMatch) {
      amountDue = toNum(amountDueMatch[1]);
    } else {
      amountDue = aging.current + aging.days30 + aging.days60 + aging.days90 + aging.over90;
    }

    // Normalize unit key for consistent lookup (uppercase, trimmed)
    const unitKey = unit.toUpperCase().trim();
    tenantMap.set(unitKey, { unit, name, rent, transactions, aging, amountDue });
  }

  return tenantMap;
}
