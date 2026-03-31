"use client";

import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, FileText, CheckCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { parseARReport } from "@/lib/parsers/ar-parser";
import { parseLedgerPDF } from "@/lib/parsers/ledger-parser";
import { parseRoster } from "@/lib/parsers/roster-parser";
import { mergeTenantData } from "@/lib/parsers/merge";
import { useDashboardStore } from "@/lib/store";
export function FileUpload() {
  const { setTenants, setIsLoading } = useDashboardStore();
  const [arFile, setArFile] = useState<File | null>(null);
  const [ledgerFile, setLedgerFile] = useState<File | null>(null);
  const [rosterFile, setRosterFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");

  const processFiles = useCallback(async () => {
    if (!arFile && !ledgerFile && !rosterFile) {
      setStatus("Please upload at least one file.");
      return;
    }

    setIsLoading(true);
    setStatus("Parsing files...");

    try {
      const arData = arFile ? await parseARReport(arFile) : [];
      const ledgerData = ledgerFile
        ? await parseLedgerPDF(ledgerFile)
        : new Map();
      const rosterData = rosterFile ? await parseRoster(rosterFile) : [];

      // merge handles all combinations: AR-only, ledger-only, roster-only, or any mix
      const tenants = mergeTenantData(arData, ledgerData, rosterData);
      setTenants(tenants);
      setStatus(`Loaded ${tenants.length} tenants successfully.`);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "Failed to parse files"}`);
    } finally {
      setIsLoading(false);
    }
  }, [arFile, ledgerFile, rosterFile, setTenants, setIsLoading]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Upload Yardi Reports</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <FileDropZone
            label="Aged Receivables (.xlsx)"
            icon={<FileSpreadsheet className="h-8 w-8" />}
            accept=".xlsx,.xls,.csv"
            file={arFile}
            onFile={setArFile}
          />
          <FileDropZone
            label="Tenant Ledger (.pdf)"
            icon={<FileText className="h-8 w-8" />}
            accept=".pdf"
            file={ledgerFile}
            onFile={setLedgerFile}
          />
          <FileDropZone
            label="Tenant Roster (.xlsx)"
            icon={<FileSpreadsheet className="h-8 w-8" />}
            accept=".xlsx,.xls,.csv"
            file={rosterFile}
            onFile={setRosterFile}
          />
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={processFiles} disabled={!arFile && !ledgerFile && !rosterFile}>
            <Upload className="h-4 w-4 mr-2" />
            Process Files
          </Button>
          {status && (
            <span className={`text-sm ${status.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
              {status}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FileDropZone({
  label,
  icon,
  accept,
  file,
  onFile,
}: {
  label: string;
  icon: React.ReactNode;
  accept: string;
  file: File | null;
  onFile: (f: File) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <label
      className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
        dragOver ? "border-primary bg-accent" : file ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-gray-400"
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
        }}
      />
      {file ? (
        <CheckCircle className="h-8 w-8 text-green-600 mb-2" />
      ) : (
        <span className="text-muted-foreground mb-2">{icon}</span>
      )}
      <span className="text-sm font-medium">{label}</span>
      {file && <span className="text-xs text-muted-foreground mt-1">{file.name}</span>}
    </label>
  );
}
