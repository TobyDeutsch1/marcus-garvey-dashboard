"use client";

import { useState, useCallback } from "react";
import { Upload, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useDashboardStore } from "@/lib/store";
import { parseARReport } from "@/lib/parsers/ar-parser";
import { mergeTenantData } from "@/lib/parsers/merge";
import { buildComparisonData } from "@/lib/parsers/merge";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

export function ComparisonMode() {
  const { tenants, comparisonData, setComparisonData } = useDashboardStore();
  const [prevFile, setPrevFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const handleCompare = useCallback(async () => {
    if (!prevFile || tenants.length === 0) {
      setStatus("Upload a previous AR report and ensure current data is loaded.");
      return;
    }

    setLoading(true);
    try {
      const prevARData = await parseARReport(prevFile);
      const prevTenants = mergeTenantData(prevARData, new Map(), []);
      const comparison = buildComparisonData(tenants, prevTenants);
      setComparisonData(comparison);
      setStatus(`Comparing ${comparison.length} tenants.`);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "Parse failed"}`);
    } finally {
      setLoading(false);
    }
  }, [prevFile, tenants, setComparisonData]);

  const totalPrevBal = comparisonData.reduce((s, d) => s + d.previousBalance, 0);
  const totalCurrBal = comparisonData.reduce((s, d) => s + d.currentBalance, 0);
  const totalDelta = totalCurrBal - totalPrevBal;

  const chartData = comparisonData
    .filter((d) => d.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 15)
    .map((d) => ({
      name: `${d.unit}`,
      delta: d.delta,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">AR Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload previous report */}
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg cursor-pointer hover:border-gray-400">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPrevFile(f);
              }}
            />
            <Upload className="h-4 w-4" />
            <span className="text-sm">
              {prevFile ? prevFile.name : "Upload Previous AR Report"}
            </span>
          </label>
          <Button onClick={handleCompare} disabled={!prevFile || loading || tenants.length === 0}>
            {loading ? "Comparing..." : "Compare Reports"}
          </Button>
          {status && <span className="text-sm text-muted-foreground">{status}</span>}
        </div>

        {comparisonData.length > 0 && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Previous Total AR</div>
                <div className="text-xl font-bold">{formatCurrency(totalPrevBal)}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Current Total AR</div>
                <div className="text-xl font-bold">{formatCurrency(totalCurrBal)}</div>
              </div>
              <div className={`p-4 border rounded-lg ${totalDelta > 0 ? "bg-red-50" : "bg-green-50"}`}>
                <div className="text-sm text-muted-foreground">Net Change</div>
                <div className={`text-xl font-bold flex items-center gap-1 ${totalDelta > 0 ? "text-red-700" : "text-green-700"}`}>
                  {totalDelta > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  {formatCurrency(Math.abs(totalDelta))}
                  {totalDelta > 0 ? " increase" : " decrease"}
                </div>
              </div>
            </div>

            {/* Delta Chart */}
            {chartData.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3">Top Balance Changes by Unit</h4>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => `$${v}`} fontSize={12} />
                      <YAxis type="category" dataKey="name" fontSize={12} width={60} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Bar dataKey="delta" radius={[0, 4, 4, 0]}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={entry.delta > 0 ? "#ef4444" : "#22c55e"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Detail Table */}
            <div className="border rounded-lg overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Unit</th>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-right">Previous</th>
                    <th className="p-2 text-right">Current</th>
                    <th className="p-2 text-right">Delta</th>
                    <th className="p-2 text-center">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData
                    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
                    .map((row) => (
                      <tr key={row.tenantId} className="border-t hover:bg-muted/50">
                        <td className="p-2 font-medium">{row.unit}</td>
                        <td className="p-2">{row.name}</td>
                        <td className="p-2 text-right">{formatCurrency(row.previousBalance)}</td>
                        <td className="p-2 text-right">{formatCurrency(row.currentBalance)}</td>
                        <td
                          className={`p-2 text-right font-semibold ${
                            row.delta > 0 ? "text-red-600" : row.delta < 0 ? "text-green-600" : ""
                          }`}
                        >
                          {row.delta > 0 ? "+" : ""}
                          {formatCurrency(row.delta)}
                        </td>
                        <td className="p-2 text-center">
                          {row.delta > 0 ? (
                            <TrendingUp className="h-4 w-4 text-red-500 inline" />
                          ) : row.delta < 0 ? (
                            <TrendingDown className="h-4 w-4 text-green-500 inline" />
                          ) : (
                            <Minus className="h-4 w-4 text-gray-400 inline" />
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {comparisonData.length === 0 && tenants.length > 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Upload a previous AR report to compare against current data.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
