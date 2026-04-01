"use client";

import { useState } from "react";
import {
  Building2,
  LayoutDashboard,
  Scale,
  GitCompare,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/FileUpload";
import { SummaryCards } from "@/components/SummaryCards";
import { RiskFilter } from "@/components/RiskFilter";
import { TenantTable } from "@/components/TenantTable";
import { LegalReview } from "@/components/LegalReview";
import { ComparisonMode } from "@/components/ComparisonMode";
import { useDashboardStore } from "@/lib/store";

const viewTabs = [
  { key: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { key: "legal" as const, label: "Legal Review", icon: Scale },
  { key: "comparison" as const, label: "Comparison", icon: GitCompare },
];

export default function Home() {
  const {
    activeTab,
    setActiveTab,
    tenants,
    isLoading,
    properties,
    activePropertyCode,
    switchProperty,
    removeProperty,
  } = useDashboardStore();

  const [uploadCollapsed, setUploadCollapsed] = useState(false);
  const [showUploadForNew, setShowUploadForNew] = useState(false);

  const hasData = tenants.length > 0;
  const hasProperties = properties.length > 0;
  const activeProperty = properties.find((p) => p.code === activePropertyCode);
  const headerTitle = activeProperty?.name || "Yardi AR Dashboard";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-lg font-bold leading-tight">{headerTitle}</h1>
                {hasData && (
                  <p className="text-xs text-muted-foreground">
                    {tenants.length} tenants loaded
                  </p>
                )}
              </div>
            </div>
            <nav className="flex gap-1">
              {viewTabs.map((tab) => (
                <Button
                  key={tab.key}
                  variant={activeTab === tab.key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab(tab.key)}
                >
                  <tab.icon className="h-4 w-4 mr-1.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">
                    {tab.key === "dashboard"
                      ? "Board"
                      : tab.key === "legal"
                      ? "Legal"
                      : "Cmp"}
                  </span>
                </Button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Property Tabs (shown when multiple properties loaded) */}
      {hasProperties && (
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 py-2 overflow-x-auto">
              {properties.map((prop) => (
                <button
                  key={prop.code}
                  onClick={() => {
                    switchProperty(prop.code);
                    setShowUploadForNew(false);
                  }}
                  className={`group relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    activePropertyCode === prop.code && !showUploadForNew
                      ? "bg-primary text-primary-foreground"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  {prop.name}
                  <span className="text-xs opacity-70">({prop.tenants.length})</span>
                  {properties.length > 1 && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProperty(prop.code);
                      }}
                      className="ml-1 opacity-0 group-hover:opacity-100 hover:text-red-300 transition-opacity cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </button>
              ))}
              <button
                onClick={() => {
                  setShowUploadForNew(true);
                  setUploadCollapsed(false);
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  showUploadForNew
                    ? "bg-primary text-primary-foreground"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Property
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* File Upload — show if no data, or when adding new property */}
        {(!hasProperties || showUploadForNew || !uploadCollapsed) && (
          <div className="bg-white rounded-lg border shadow-sm">
            <div
              className="flex items-center justify-between px-6 py-4 cursor-pointer"
              onClick={() => hasData && setUploadCollapsed(!uploadCollapsed)}
            >
              <h2 className="text-base font-semibold">
                {showUploadForNew ? "Upload Reports for New Property" : "Upload Yardi Reports"}
              </h2>
              {hasData && !showUploadForNew && (
                <button className="text-muted-foreground hover:text-foreground">
                  {uploadCollapsed ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
            {(!uploadCollapsed || showUploadForNew || !hasData) && (
              <div className="px-6 pb-6">
                <FileUpload />
              </div>
            )}
          </div>
        )}

        {/* Collapsed upload toggle */}
        {hasProperties && uploadCollapsed && !showUploadForNew && (
          <button
            onClick={() => setUploadCollapsed(false)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className="h-3 w-3 inline mr-1" />
            Show upload panel
          </button>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center justify-center py-8 bg-white rounded-lg border">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground">
              Parsing files — this may take a moment for large PDFs…
            </span>
          </div>
        )}

        {/* Tab Content */}
        {!isLoading && activeTab === "dashboard" && (
          <>
            {hasData ? (
              <>
                <SummaryCards />
                <div className="bg-white rounded-lg border shadow-sm p-4">
                  <h2 className="text-base font-semibold mb-3">Tenant Overview</h2>
                  <RiskFilter />
                </div>
                <TenantTable />
              </>
            ) : (
              !hasProperties && (
                <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
                  <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
                  <h3 className="text-lg font-semibold mb-2">No Data Loaded</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Upload your Yardi Aged Receivables (.xlsx), Tenant Ledger (.pdf), and/or
                    Tenant Roster (.xlsx) above, then click Process Files.
                  </p>
                </div>
              )
            )}
          </>
        )}

        {!isLoading && activeTab === "legal" && <LegalReview />}
        {!isLoading && activeTab === "comparison" && <ComparisonMode />}
      </main>
    </div>
  );
}
