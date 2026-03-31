import * as XLSX from "xlsx";

export interface RosterEntry {
  unit: string;
  applicant: string;
  rent: number;
  phone: string;
  email: string;
}

export function parseRoster(file: File): Promise<RosterEntry[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const entries: RosterEntry[] = rows
          .map((row) => {
            // Try to match columns by name (case-insensitive)
            const keys = Object.keys(row);
            const findCol = (patterns: string[]) => {
              for (const p of patterns) {
                const key = keys.find((k) => k.toLowerCase().includes(p.toLowerCase()));
                if (key) return String(row[key]).trim();
              }
              return "";
            };

            return {
              unit: findCol(["unit", "apt", "suite"]),
              applicant: findCol(["applicant", "name", "tenant", "resident"]),
              rent: parseFloat(findCol(["rent", "amount", "monthly"]).replace(/[$,]/g, "")) || 0,
              phone: findCol(["phone", "tel", "mobile", "cell"]),
              email: findCol(["email", "e-mail", "mail"]),
            };
          })
          .filter((e) => e.unit);

        resolve(entries);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
