"use client";

import { useMemo } from "react";
import { ChevronDown, ChevronUp, ChevronRight, Search } from "lucide-react";
import { useDashboardStore } from "@/lib/store";
import { formatCurrency, formatDate, getRowColor, getTierBadgeColor } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { TenantDetail } from "./TenantDetail";
import { SortField, Tenant } from "@/lib/types";

const columns: { key: SortField; label: string; align?: string }[] = [
  { key: "unit", label: "Unit" },
  { key: "name", label: "Name" },
  { key: "balance", label: "Balance", align: "right" },
  { key: "current", label: "Current", align: "right" },
  { key: "days30", label: "0-30", align: "right" },
  { key: "days60", label: "31-60", align: "right" },
  { key: "days90", label: "61-90", align: "right" },
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

  if (tenants.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Upload Yardi reports above to view tenant data.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by unit, name, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="w-8 p-3"></th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`p-3 font-medium cursor-pointer hover:bg-accent select-none ${
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
              <>
                <tr
                  key={tenant.id}
                  className={`border-t cursor-pointer transition-colors ${getRowColor(
                    tenant.riskTier
                  )}`}
                  onClick={() => setExpandedTenantId(tenant.id)}
                >
                  <td className="p-3">
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${
                        expandedTenantId === tenant.id ? "rotate-90" : ""
                      }`}
                    />
                  </td>
                  <td className="p-3 font-medium">{tenant.unit}</td>
                  <td className="p-3">
                    {tenant.lastName}, {tenant.firstName}
                    {tenant.email && (
                      <span className="block text-xs text-muted-foreground">{tenant.email}</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-semibold">{formatCurrency(tenant.balance)}</td>
                  <td className="p-3 text-right">{tenant.current > 0 ? formatCurrency(tenant.current) : "-"}</td>
                  <td className="p-3 text-right">{tenant.days30 > 0 ? formatCurrency(tenant.days30) : "-"}</td>
                  <td className="p-3 text-right">{tenant.days60 > 0 ? formatCurrency(tenant.days60) : "-"}</td>
                  <td className="p-3 text-right">{tenant.days90 > 0 ? formatCurrency(tenant.days90) : "-"}</td>
                  <td className="p-3 text-right">{tenant.over90 > 0 ? formatCurrency(tenant.over90) : "-"}</td>
                  <td className="p-3">{formatDate(tenant.lastPaymentDate)}</td>
                  <td className="p-3">
                    <Badge className={getTierBadgeColor(tenant.riskTier)}>
                      {tenant.riskTier === "at-risk"
                        ? "At Risk"
                        : tenant.riskTier === "legal-review"
                        ? "Legal"
                        : tenant.riskTier.charAt(0).toUpperCase() + tenant.riskTier.slice(1)}
                    </Badge>
                  </td>
                </tr>
                {expandedTenantId === tenant.id && (
                  <tr key={`${tenant.id}-detail`}>
                    <td colSpan={11} className="p-4 bg-white">
                      <TenantDetail tenant={tenant} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No tenants match the current filters.
          </div>
        )}
      </div>
      <div className="text-sm text-muted-foreground">
        Showing {filtered.length} of {tenants.length} tenants
      </div>
    </div>
  );
}
