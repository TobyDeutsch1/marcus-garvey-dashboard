"use client";

import { create } from "zustand";
import { Tenant, Property, RiskTier, SortField, SortDirection, ComparisonData } from "./types";
import { getRiskTier } from "./utils";

interface DashboardState {
  // Multi-property
  properties: Property[];
  activePropertyCode: string | null;

  // Derived from active property (set via switchProperty / addProperty)
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

  // Property actions
  addProperty: (code: string, name: string, tenants: Tenant[]) => void;
  switchProperty: (code: string) => void;
  removeProperty: (code: string) => void;

  // Legacy single-property setter (for backward compat)
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
  properties: [],
  activePropertyCode: null,
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

  addProperty: (code, name, tenants) =>
    set((state) => {
      // Replace if property already exists, otherwise add
      const existing = state.properties.findIndex((p) => p.code === code);
      const newProp: Property = { code, name, tenants };
      const properties =
        existing >= 0
          ? state.properties.map((p, i) => (i === existing ? newProp : p))
          : [...state.properties, newProp];
      return {
        properties,
        activePropertyCode: code,
        tenants,
        expandedTenantId: null,
        riskFilter: "all",
        searchQuery: "",
      };
    }),

  switchProperty: (code) =>
    set((state) => {
      const prop = state.properties.find((p) => p.code === code);
      if (!prop) return state;
      return {
        activePropertyCode: code,
        tenants: prop.tenants,
        expandedTenantId: null,
        riskFilter: "all",
        searchQuery: "",
        activeTab: "dashboard",
      };
    }),

  removeProperty: (code) =>
    set((state) => {
      const properties = state.properties.filter((p) => p.code !== code);
      const wasActive = state.activePropertyCode === code;
      if (wasActive && properties.length > 0) {
        return {
          properties,
          activePropertyCode: properties[0].code,
          tenants: properties[0].tenants,
          expandedTenantId: null,
        };
      }
      if (wasActive) {
        return { properties, activePropertyCode: null, tenants: [], expandedTenantId: null };
      }
      return { properties };
    }),

  // Legacy setter — adds as a default property if no property context
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
    set((state) => {
      const newTenants = state.tenants.map((t) => {
        if (t.id !== tenantId) return t;
        const updated = { ...t, flaggedForLegal: !t.flaggedForLegal };
        updated.riskTier = getRiskTier(updated);
        return updated;
      });
      // Also update in properties array
      const properties = state.properties.map((p) =>
        p.code === state.activePropertyCode ? { ...p, tenants: newTenants } : p
      );
      return { tenants: newTenants, properties };
    }),
  togglePaymentPlan: (tenantId) =>
    set((state) => {
      const newTenants = state.tenants.map((t) =>
        t.id === tenantId ? { ...t, paymentPlan: !t.paymentPlan } : t
      );
      const properties = state.properties.map((p) =>
        p.code === state.activePropertyCode ? { ...p, tenants: newTenants } : p
      );
      return { tenants: newTenants, properties };
    }),
  setIsLoading: (loading) => set({ isLoading: loading }),
}));
