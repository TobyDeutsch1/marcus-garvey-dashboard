"use client";

import React, { useMemo } from "react";
import { ChevronDown, ChevronUp, ChevronRight, Search, X } from "lucide-react";
import { useDashboardStore } from "@/lib/store";
import { formatCurrency, formatDate, getRowColor, getTierBadgeColor } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { TenantDetail } from "./TenantDetail";
import { SortField, Tenant } from "@/lib/types";
import { Button } from "./ui/button";

const columns: { key: SortField; label: string; align?: string }[] = [
  { key: "unit", label: "Unit" },
  { key: "name", label: "Name" },
  { key: "balance", label: "Balance", align: "right" },
  { key: "current", label: "Current", align: "right" },
  { key: "days30", label: "0–30", align: "right" },
  { key: "days60", label: "31–60", align: "right" },
  { key: "days90", label: "61–90", align: "right" },
  { key: "over90", label: "90+", align: "right" },
  { key: "lastPaymentDate", label: "Last Payment" },
];

function sortTenants(tenants: Tenant[], field: SortField, dir: "asc" | "desc") {
  return [...tenants].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;
    if (field === "name") {
      aVal = `${a.lastName}, ${a.firstName}`.toLowerCase();
      bVal = `${b.lastName}, ${b.firstName}`.toLowerCase();
    } else if (field === "lastPaymentDate") {
      aVal = a.lastPaymentDate || "";
      bVal = b.lastPaymentDate || "";
    } else {
      aVal = a[field] as number;
      bVal = b[field] as number;
    }
    if (aVal < bVal) return dir === "asc" ? -1 : 1;
    if (aVal > bVal) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

export function TenantTable() {
  const {
    tenants,
    riskFilter,
    searchQuery,
    sortField,
    sortDirection,
    expandedTenantId,
    setSortField,
    setSearchQuery,
    setRiskFilter,
    setExpandedTenantId,
  } = useDashboardStore();

  const filtered = useMemo(() => {
    let result = tenants;
    if (riskFilter !== "all") {
      result = result.filter((t) => t.riskTier === riskFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.unit.toLowerCase().includes(q) ||
          t.firstName.toLowerCase().includes(q) ||
          t.lastName.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q)
      );
    }
    return sortTenants(result, sortField, sortDirection);
  }, [tenants, riskFilter, searchQuery, sortField, sortDirection]);

  const isFiltered = riskFilter !== "all" || searchQuery !== "";

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      {/* Search bar */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by unit, name, or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="w-8 p-3"></th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`p-3 font-medium cursor-pointer hover:bg-muted select-none whitespace-nowrap ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                  onClick={() => setSortField(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortField === col.key &&
                      (sortDirection === "asc" ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      ))}
                  </span>
                </th>
              ))}
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tenant) => (
              <React.Fragment key={tenant.id}>
                <tr
                  className={`border-t cursor-pointer transition-colors ${getRowColor(tenant.riskTier)}`}
                  onClick={() => setExpandedTenantId(tenant.id)}
                >
                  <td className="p-3">
                    <ChevronRight
                      className={`h-4 w-4 transition-transform duration-150 ${
                        expandedTenantId === tenant.id ? "rotate-90" : ""
                      }`}
                    />
                  </td>
                  <td className="p-3 font-medium">{tenant.unit}</td>
                  <td className="p-3">
                    <span className="font-medium">
                      {[tenant.lastName, tenant.firstName].filter(Boolean).join(", ") || "—"}
                    </span>
                    {tenant.email && (
                      <span className="block text-xs text-muted-foreground truncate max-w-[200px]">
                        {tenant.email}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right font-semibold">{formatCurrency(tenant.balance)}</td>
                  <td className="p-3 text-right">{tenant.current > 0 ? formatCurrency(tenant.current) : "—"}</td>
                  <td className="p-3 text-right">{tenant.days30 > 0 ? formatCurrency(tenant.days30) : "—"}</td>
                  <td className="p-3 text-right">{tenant.days60 > 0 ? formatCurrency(tenant.days60) : "—"}</td>
                  <td className="p-3 text-right">{tenant.days90 > 0 ? formatCurrency(tenant.days90) : "—"}</td>
                  <td className="p-3 text-right">{tenant.over90 > 0 ? formatCurrency(tenant.over90) : "—"}</td>
                  <td className="p-3">{formatDate(tenant.lastPaymentDate)}</td>
                  <td className="p-3">
                    <Badge className={getTierBadgeColor(tenant.riskTier)}>
                      {tenant.riskTier === "at-risk"
                        ? "At Risk"
                        : tenant.riskTier === "legal-review"
                        ? "Legal"
                        : tenant.riskTier === "watch"
                        ? "Watch"
                        : "Current"}
                    </Badge>
                  </td>
                </tr>
                {expandedTenantId === tenant.id && (
                  <tr>
                    <td colSpan={11} className="p-0 bg-white border-t">
                      <div className="p-4">
                        <TenantDetail tenant={tenant} />
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {isFiltered ? (
              <div className="space-y-2">
                <p>No tenants match the current filters.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setRiskFilter("all"); setSearchQuery(""); }}
                >
                  Clear Filters
                </Button>
              </div>
            ) : (
              <p>No tenants loaded.</p>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t text-xs text-muted-foreground">
        Showing {filtered.length} of {tenants.length} tenants
        {isFiltered && ` (filtered)`}
      </div>
    </div>
  );
}
