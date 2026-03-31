"use client";

import { Button } from "./ui/button";
import { useDashboardStore } from "@/lib/store";
import { RiskTier } from "@/lib/types";

const tiers: { label: string; value: RiskTier | "all"; color: string }[] = [
  { label: "All", value: "all", color: "bg-gray-100 hover:bg-gray-200 text-gray-800" },
  { label: "Current", value: "current", color: "bg-green-100 hover:bg-green-200 text-green-800" },
  { label: "Watch", value: "watch", color: "bg-yellow-100 hover:bg-yellow-200 text-yellow-800" },
  { label: "At Risk", value: "at-risk", color: "bg-orange-100 hover:bg-orange-200 text-orange-800" },
  { label: "Legal Review", value: "legal-review", color: "bg-red-100 hover:bg-red-200 text-red-800" },
];

export function RiskFilter() {
  const { riskFilter, setRiskFilter, tenants } = useDashboardStore();

  const counts: Record<string, number> = { all: tenants.length };
  for (const t of tenants) {
    counts[t.riskTier] = (counts[t.riskTier] || 0) + 1;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tiers.map((tier) => (
        <Button
          key={tier.value}
          variant="ghost"
          size="sm"
          onClick={() => setRiskFilter(tier.value)}
          className={`${tier.color} ${
            riskFilter === tier.value ? "ring-2 ring-offset-1 ring-gray-400" : ""
          }`}
        >
          {tier.label}
          <span className="ml-1.5 text-xs opacity-70">({counts[tier.value] || 0})</span>
        </Button>
      ))}
    </div>
  );
}
