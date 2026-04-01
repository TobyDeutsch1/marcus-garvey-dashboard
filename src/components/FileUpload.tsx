"use client";

import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, FileText, CheckCircle, X } from "lucide-react";
import { Button } from "./ui/button";
import { parseARReport } from "@/lib/parsers/ar-parser";
import { parseLedgerPDF } from "@/lib/parsers/ledger-parser";
import { parseRoster } from "@/lib/parsers/roster-parser";
import { mergeTenantData } from "@/lib/parsers/merge";
import { useDashboardStore } from "@/lib/store";
import { propertyDisplayName } from "@/lib/property-names";

export function FileUpload() {
  const { addProperty, setIsLoading } = useDashboardStore();
  const [arFile, setArFile] = useState<File | null>(null);
  const [ledgerFile, setLedgerFile] = useState<File | null>(null);
  const [rosterFile, setRosterFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const hasAnyFile = !!(arFile || ledgerFile || rosterFile);

  const processFiles = useCallback(async () => {
    if (!hasAnyFile) return;

    setIsLoading(true);
    setStatus({ type: "info", text: "Parsing files…" });

    try {
      const [arData, ledgerResult, rosterData] = await Promise.all([
        arFile ? parseARReport(arFile) : Promise.resolve([]),
        ledgerFile
          ? parseLedgerPDF(ledgerFile)
          : Promise.resolve({ tenants: new Map(), propertyCode: "" }),
        rosterFile ? parseRoster(rosterFile) : Promise.resolve([]),
      ]);

      const ledgerData = ledgerResult.tenants;
      const propertyCode = ledgerResult.propertyCode;
      const tenants = mergeTenantData(arData, ledgerData, rosterData);

      if (tenants.length === 0) {
        setStatus({
          type: "error",
          text: "No tenants found. Check that your files match the expected format.",
        });
      } else {
        // Determine property name
        const code = propertyCode || "default";
        const displayName = propertyDisplayName(code);

        // Add as a property tab
        addProperty(code, displayName, tenants);

        setStatus({
          type: "success",
          text: `Loaded ${tenants.length} tenants for ${displayName}.`,
        });

        // Clear files for next upload
        setArFile(null);
        setLedgerFile(null);
        setRosterFile(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus({ type: "error", text: `Parse error: ${msg}` });
      console.error("File parse error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [arFile, ledgerFile, rosterFile, hasAnyFile, addProperty, setIsLoading]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FileDropZone
          label="Aged Receivables (.xlsx)"
          hint="Yardi AR report — one sheet, tenant rows with aging buckets"
          icon={<FileSpreadsheet className="h-7 w-7" />}
          accept=".xlsx,.xls,.csv"
          file={arFile}
          onFile={setArFile}
          onClear={() => setArFile(null)}
        />
        <FileDropZone
          label="Tenant Ledger (.pdf)"
          hint="Yardi tenant ledger — one page per tenant"
          icon={<FileText className="h-7 w-7" />}
          accept=".pdf"
          file={ledgerFile}
          onFile={setLedgerFile}
          onClear={() => setLedgerFile(null)}
        />
        <FileDropZone
          label="Tenant Roster (.xlsx)"
          hint="Unit, Applicant, Rent, Phone, Email columns"
          icon={<FileSpreadsheet className="h-7 w-7" />}
          accept=".xlsx,.xls,.csv"
          file={rosterFile}
          onFile={setRosterFile}
          onClear={() => setRosterFile(null)}
        />
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={processFiles} disabled={!hasAnyFile}>
          <Upload className="h-4 w-4 mr-2" />
          Process Files
        </Button>
        {status && (
          <span
            className={`text-sm ${
              status.type === "error"
                ? "text-red-600"
                : status.type === "success"
                ? "text-green-600"
                : "text-muted-foreground"
            }`}
          >
            {status.text}
          </span>
        )}
      </div>
    </div>
  );
}

function FileDropZone({
  label,
  hint,
  icon,
  accept,
  file,
  onFile,
  onClear,
}: {
  label: string;
  hint: string;
  icon: React.ReactNode;
  accept: string;
  file: File | null;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="relative">
      <label
        className={`relative flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-lg cursor-pointer transition-colors min-h-[120px] ${
          dragOver
            ? "border-primary bg-blue-50"
            : file
            ? "border-green-400 bg-green-50"
            : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
      >
        <input
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        {file ? (
          <CheckCircle className="h-7 w-7 text-green-600 mb-2 flex-shrink-0" />
        ) : (
          <span className="text-muted-foreground mb-2 flex-shrink-0">{icon}</span>
        )}
        <span className="text-sm font-medium text-center">{label}</span>
        {file ? (
          <span className="text-xs text-muted-foreground mt-1 text-center truncate max-w-full px-2">
            {file.name}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground mt-1 text-center leading-tight px-2">
            {hint}
          </span>
        )}
      </label>
      {file && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="absolute top-2 right-2 p-1 rounded-full bg-white border hover:bg-red-50 hover:border-red-300 transition-colors"
          title="Remove file"
        >
          <X className="h-3 w-3 text-muted-foreground hover:text-red-500" />
        </button>
      )}
    </div>
  );
}
