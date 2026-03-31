"use client";

import { useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import { Download, Scale, X } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useDashboardStore } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";

export function LegalReview() {
  const { tenants, toggleLegalFlag } = useDashboardStore();

  const flagged = useMemo(
    () => tenants.filter((t) => t.flaggedForLegal),
    [tenants]
  );

  const exportToExcel = useCallback(() => {
    const data = flagged.map((t) => ({
      Unit: t.unit,
      Name: `${t.lastName}, ${t.firstName}`,
      Email: t.email,
      Phone: t.phone,
      "Total Balance": t.balance,
      Current: t.current,
      "0-30 Days": t.days30,
      "31-60 Days": t.days60,
      "61-90 Days": t.days90,
      "Over 90 Days": t.over90,
      "Last Payment": t.lastPaymentDate || "N/A",
      "Payment Plan": t.paymentPlan ? "Yes" : "No",
      "Monthly Rent": t.rent,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Legal Review");

    // Auto-width columns
    const colWidths = Object.keys(data[0] || {}).map((key) => ({
      wch: Math.max(key.length, 15),
    }));
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, `legal-review-${new Date().toISOString().split("T")[0]}.xlsx`);
  }, [flagged]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Legal Review
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {flagged.length} tenant{flagged.length !== 1 ? "s" : ""} flagged for legal review
          </p>
        </div>
        {flagged.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportToExcel}>
            <Download className="h-4 w-4 mr-1" />
            Export to Excel
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {flagged.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No tenants flagged for legal review. Click &quot;Flag for Legal&quot; on a tenant to add them here.
          </div>
        ) : (
          <div className="space-y-3">
            {flagged.map((tenant) => (
              <div
                key={tenant.id}
                className="flex items-center justify-between p-4 border rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      Unit {tenant.unit} - {tenant.lastName}, {tenant.firstName}
                    </span>
                    {tenant.paymentPlan && (
                      <Badge className="bg-blue-100 text-blue-800">Payment Plan</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-4">
                    <span>Balance: <strong className="text-red-700">{formatCurrency(tenant.balance)}</strong></span>
                    <span>Over 90: {formatCurrency(tenant.over90)}</span>
                    <span>Last Payment: {formatDate(tenant.lastPaymentDate)}</span>
                    {tenant.email && <span>{tenant.email}</span>}
                    {tenant.phone && <span>{tenant.phone}</span>}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleLegalFlag(tenant.id)}
                  title="Remove from legal review"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {/* Summary */}
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Flagged Balance</span>
                  <div className="text-lg font-bold text-red-700">
                    {formatCurrency(flagged.reduce((s, t) => s + t.balance, 0))}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Over 90 Days</span>
                  <div className="text-lg font-bold">
                    {formatCurrency(flagged.reduce((s, t) => s + t.over90, 0))}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">On Payment Plans</span>
                  <div className="text-lg font-bold">
                    {flagged.filter((t) => t.paymentPlan).length}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Balance</span>
                  <div className="text-lg font-bold">
                    {formatCurrency(
                      flagged.reduce((s, t) => s + t.balance, 0) / flagged.length
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
