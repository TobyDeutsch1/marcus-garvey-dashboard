"use client";

import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useDashboardStore } from "@/lib/store";
import { Tenant } from "@/lib/types";
import { formatCurrency, formatDate, getTierBadgeColor } from "@/lib/utils";
import { AlertTriangle, FileText, Mail, Phone, Scale, CreditCard } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export function TenantDetail({ tenant }: { tenant: Tenant }) {
  const { toggleLegalFlag, togglePaymentPlan } = useDashboardStore();

  const agingData = [
    { name: "Current", amount: tenant.current, fill: "#22c55e" },
    { name: "0-30", amount: tenant.days30, fill: "#eab308" },
    { name: "31-60", amount: tenant.days60, fill: "#f97316" },
    { name: "61-90", amount: tenant.days90, fill: "#ef4444" },
    { name: "90+", amount: tenant.over90, fill: "#991b1b" },
  ];

  // Payment pattern: last 6 months
  const paymentsByMonth = new Map<string, number>();
  for (const txn of tenant.transactions) {
    if (txn.payments > 0) {
      try {
        const d = new Date(txn.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        paymentsByMonth.set(key, (paymentsByMonth.get(key) || 0) + txn.payments);
      } catch {
        // skip
      }
    }
  }
  const paymentPattern = Array.from(paymentsByMonth.entries())
    .sort()
    .slice(-6)
    .map(([month, amount]) => ({ month, amount }));

  return (
    <div className="bg-white border rounded-lg p-6 space-y-6 animate-in slide-in-from-top-2">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">
            {tenant.firstName} {tenant.lastName}
          </h3>
          <p className="text-sm text-muted-foreground">
            Unit {tenant.unit} &middot; Rent: {formatCurrency(tenant.rent)}
          </p>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            {tenant.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" /> {tenant.email}
              </span>
            )}
            {tenant.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> {tenant.phone}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getTierBadgeColor(tenant.riskTier)}>
            {tenant.riskTier.replace("-", " ").toUpperCase()}
          </Badge>
          {tenant.paymentPlan && (
            <Badge className="bg-blue-100 text-blue-800">Payment Plan</Badge>
          )}
        </div>
      </div>

      {/* Aging Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-medium mb-3">Aging Breakdown</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {agingData.map((entry, i) => (
                    <rect key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {paymentPattern.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Payment Pattern</h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentPattern}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Transaction History */}
      {tenant.transactions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3">
            <FileText className="h-4 w-4 inline mr-1" />
            Transaction History
          </h4>
          <div className="max-h-64 overflow-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Description</th>
                  <th className="text-right p-2">Charges</th>
                  <th className="text-right p-2">Payments</th>
                  <th className="text-right p-2">Balance</th>
                </tr>
              </thead>
              <tbody>
                {tenant.transactions.map((txn, i) => (
                  <tr key={i} className="border-t hover:bg-muted/50">
                    <td className="p-2">{txn.date}</td>
                    <td className="p-2">{txn.description}</td>
                    <td className="p-2 text-right">
                      {txn.charges > 0 ? formatCurrency(txn.charges) : "-"}
                    </td>
                    <td className="p-2 text-right text-green-600">
                      {txn.payments > 0 ? formatCurrency(txn.payments) : "-"}
                    </td>
                    <td className="p-2 text-right font-medium">
                      {formatCurrency(txn.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-2 border-t">
        <Button
          variant={tenant.flaggedForLegal ? "destructive" : "outline"}
          size="sm"
          onClick={() => toggleLegalFlag(tenant.id)}
        >
          <Scale className="h-4 w-4 mr-1" />
          {tenant.flaggedForLegal ? "Remove Legal Flag" : "Flag for Legal"}
        </Button>
        <Button
          variant={tenant.paymentPlan ? "secondary" : "outline"}
          size="sm"
          onClick={() => togglePaymentPlan(tenant.id)}
        >
          <CreditCard className="h-4 w-4 mr-1" />
          {tenant.paymentPlan ? "Remove Payment Plan" : "Set Payment Plan"}
        </Button>
        {tenant.balance > 0 && (
          <div className="ml-auto flex items-center text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 mr-1 text-orange-500" />
            Last payment: {formatDate(tenant.lastPaymentDate)}
            {tenant.lastPaymentAmount > 0 && ` (${formatCurrency(tenant.lastPaymentAmount)})`}
          </div>
        )}
      </div>
    </div>
  );
}
