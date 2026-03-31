"use client";

import { useMemo } from "react";
import { DollarSign, Users, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useDashboardStore } from "@/lib/store";
import { formatCurrency, estimateAvgDaysDelinquent } from "@/lib/utils";

export function SummaryCards() {
  const tenants = useDashboardStore((s) => s.tenants);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const totalAR = tenants.reduce((sum, t) => sum + t.balance, 0);
    const tenantsWithBalances = tenants.filter((t) => t.balance > 0).length;
    const avgDays = estimateAvgDaysDelinquent(tenants);

    let collectedThisMonth = 0;
    for (const t of tenants) {
      for (const txn of t.transactions) {
        if (txn.payments <= 0) continue;
        try {
          const d = new Date(txn.date);
          if (!isNaN(d.getTime()) && d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
            collectedThisMonth += txn.payments;
          }
        } catch {
          // skip unparseable dates
        }
      }
    }

    return { totalAR, tenantsWithBalances, collectedThisMonth, avgDays };
  }, [tenants]);

  const cards = [
    {
      title: "Total AR",
      value: formatCurrency(stats.totalAR),
      sub: `${stats.tenantsWithBalances} tenants carrying balances`,
      icon: DollarSign,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      title: "Tenants with Balances",
      value: `${stats.tenantsWithBalances} / ${tenants.length}`,
      sub: `${tenants.length - stats.tenantsWithBalances} current`,
      icon: Users,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      title: "Collected This Month",
      value: formatCurrency(stats.collectedThisMonth),
      sub: "From transaction history",
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Avg Days Delinquent",
      value: `${stats.avgDays} days`,
      sub: "Estimated from aging buckets",
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
            <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
