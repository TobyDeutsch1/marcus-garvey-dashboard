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
  };
  amountDue: number;
}

export async function parseLedgerPDF(file: File): Promise<Map<string, LedgerData>> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const tenantMap = new Map<string, LedgerData>();

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{ str: string; transform: number[] }>;

    // Sort by Y position (descending) then X position
    const sorted = items
      .filter((item) => item.str.trim())
      .sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) > 2) return yDiff;
        return a.transform[4] - b.transform[4];
      });

    const lines: string[] = [];
    let currentLine = "";
    let lastY = sorted[0]?.transform[5] ?? 0;

    for (const item of sorted) {
      const y = item.transform[5];
      if (Math.abs(y - lastY) > 5) {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = item.str;
        lastY = y;
      } else {
        currentLine += "  " + item.str;
      }
    }
    if (currentLine.trim()) lines.push(currentLine.trim());

    const fullText = lines.join("\n");

    // Extract unit
    const unitMatch = fullText.match(/Unit[:\s]+(\w+)/i);
    const unit = unitMatch?.[1] || `Page${i}`;

    // Extract name
    const nameMatch = fullText.match(/(?:Tenant|Resident|Name)[:\s]+([A-Za-z\s,'-]+)/i);
    const name = nameMatch?.[1]?.trim() || "";

    // Extract rent
    const rentMatch = fullText.match(/(?:Rent|Monthly)[:\s]*\$?([\d,]+\.?\d*)/i);
    const rent = rentMatch ? parseFloat(rentMatch[1].replace(/,/g, "")) : 0;

    // Parse transactions
    const transactions: Transaction[] = [];
    const txnRegex =
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/g;
    let match;

    while ((match = txnRegex.exec(fullText)) !== null) {
      transactions.push({
        date: match[1],
        description: match[2].trim(),
        charges: parseFloat(match[3].replace(/,/g, "")) || 0,
        payments: parseFloat(match[4].replace(/,/g, "")) || 0,
        balance: parseFloat(match[5].replace(/,/g, "")) || 0,
      });
    }

    // Also try simpler date-based line matching
    if (transactions.length === 0) {
      for (const line of lines) {
        const simpleMatch = line.match(
          /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+)/
        );
        if (simpleMatch) {
          const nums = simpleMatch[2].match(/-?[\d,]+\.?\d*/g);
          if (nums && nums.length >= 2) {
            const values = nums.map((n) => parseFloat(n.replace(/,/g, "")) || 0);
            transactions.push({
              date: simpleMatch[1],
              description: simpleMatch[2]
                .replace(/-?[\d,]+\.?\d*/g, "")
                .trim(),
              charges: values[0] || 0,
              payments: values[1] || 0,
              balance: values[values.length - 1] || 0,
            });
          }
        }
      }
    }

    // Extract aging
    const currentMatch = fullText.match(/Current[:\s]*\$?([\d,]+\.?\d*)/i);
    const days30Match = fullText.match(/30\s*(?:Days?|day)[:\s]*\$?([\d,]+\.?\d*)/i);
    const days60Match = fullText.match(/60\s*(?:Days?|day)[:\s]*\$?([\d,]+\.?\d*)/i);
    const days90Match = fullText.match(/90\s*(?:Days?|day)[:\s]*\$?([\d,]+\.?\d*)/i);
    const amountDueMatch = fullText.match(/Amount\s*Due[:\s]*\$?([\d,]+\.?\d*)/i);

    tenantMap.set(unit, {
      unit,
      name,
      rent,
      transactions,
      aging: {
        current: currentMatch ? parseFloat(currentMatch[1].replace(/,/g, "")) : 0,
        days30: days30Match ? parseFloat(days30Match[1].replace(/,/g, "")) : 0,
        days60: days60Match ? parseFloat(days60Match[1].replace(/,/g, "")) : 0,
        days90: days90Match ? parseFloat(days90Match[1].replace(/,/g, "")) : 0,
      },
      amountDue: amountDueMatch ? parseFloat(amountDueMatch[1].replace(/,/g, "")) : 0,
    });
  }

  return tenantMap;
}
