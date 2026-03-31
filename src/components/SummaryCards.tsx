"use client";

import { DollarSign, Users, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useDashboardStore } from "@/lib/store";
import { formatCurrency, estimateAvgDaysDelinquent } from "@/lib/utils";

export function SummaryCards() {
  const tenants = useDashboardStore((s) => s.tenants);

  const totalAR = tenants.reduce((sum, t) => sum + t.balance, 0);
  const tenantsWithBalances = tenants.filter((t) => t.balance > 0).length;
  const collectedThisMonth = tenants.reduce((sum, t) => {
    for (const txn of t.transactions) {
      try {
        const d = new Date(txn.date);
        const now = new Date();
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
          return sum + txn.payments;
        }
      } catch {
        // skip unparseable dates
      }
    }
    return sum;
  }, 0);
  const avgDays = estimateAvgDaysDelinquent(tenants);

  const cards = [
    {
      title: "Total AR",
      value: formatCurrency(totalAR),
      icon: DollarSign,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      title: "Tenants with Balances",
      value: `${tenantsWithBalances} / ${tenants.length}`,
      icon: Users,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      title: "Collected This Month",
      value: formatCurrency(collectedThisMonth),
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Avg Days Delinquent",
      value: `${avgDays} days`,
      icon: Clock,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <div className={`p-2 rounded-lg ${card.bg}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
