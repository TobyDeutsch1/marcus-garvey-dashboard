"use client";

import { create } from "zustand";
import { Tenant, RiskTier, SortField, SortDirection, ComparisonData } from "./types";

interface DashboardState {
  tenants: Tenant[];
  comparisonTenants: Tenant[];
  comparisonData: ComparisonData[];
  activeTab: "dashboard" | "legal" | "comparison";
  riskFilter: RiskTier | "all";
  searchQuery: string;
  sortField: SortField;
  sortDirection: SortDirection;
  expandedTenantId: string | null;
  isLoading: boolean;

  setTenants: (tenants: Tenant[]) => void;
  setComparisonTenants: (tenants: Tenant[]) => void;
  setComparisonData: (data: ComparisonData[]) => void;
  setActiveTab: (tab: "dashboard" | "legal" | "comparison") => void;
  setRiskFilter: (filter: RiskTier | "all") => void;
  setSearchQuery: (query: string) => void;
  setSortField: (field: SortField) => void;
  toggleSortDirection: () => void;
  setExpandedTenantId: (id: string | null) => void;
  toggleLegalFlag: (tenantId: string) => void;
  togglePaymentPlan: (tenantId: string) => void;
  setIsLoading: (loading: boolean) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  tenants: [],
  comparisonTenants: [],
  comparisonData: [],
  activeTab: "dashboard",
  riskFilter: "all",
  searchQuery: "",
  sortField: "balance",
  sortDirection: "desc",
  expandedTenantId: null,
  isLoading: false,

  setTenants: (tenants) => set({ tenants }),
  setComparisonTenants: (tenants) => set({ comparisonTenants: tenants }),
  setComparisonData: (data) => set({ comparisonData: data }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setRiskFilter: (filter) => set({ riskFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSortField: (field) =>
    set((state) => ({
      sortField: field,
      sortDirection: state.sortField === field && state.sortDirection === "asc" ? "desc" : "asc",
    })),
  toggleSortDirection: () =>
    set((state) => ({ sortDirection: state.sortDirection === "asc" ? "desc" : "asc" })),
  setExpandedTenantId: (id) =>
    set((state) => ({ expandedTenantId: state.expandedTenantId === id ? null : id })),
  toggleLegalFlag: (tenantId) =>
    set((state) => ({
      tenants: state.tenants.map((t) =>
        t.id === tenantId
          ? {
              ...t,
              flaggedForLegal: !t.flaggedForLegal,
              riskTier: !t.flaggedForLegal ? "legal-review" : t.over90 > 0 ? "at-risk" : t.days60 > 0 || t.days90 > 0 ? "watch" : "current",
            }
          : t
      ),
    })),
  togglePaymentPlan: (tenantId) =>
    set((state) => ({
      tenants: state.tenants.map((t) =>
        t.id === tenantId ? { ...t, paymentPlan: !t.paymentPlan } : t
      ),
    })),
  setIsLoading: (loading) => set({ isLoading: loading }),
}));
