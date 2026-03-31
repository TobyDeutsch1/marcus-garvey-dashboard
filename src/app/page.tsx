"use client";

import { Building2, LayoutDashboard, Scale, GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/FileUpload";
import { SummaryCards } from "@/components/SummaryCards";
import { RiskFilter } from "@/components/RiskFilter";
import { TenantTable } from "@/components/TenantTable";
import { LegalReview } from "@/components/LegalReview";
import { ComparisonMode } from "@/components/ComparisonMode";
import { useDashboardStore } from "@/lib/store";

const tabs = [
  { key: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { key: "legal" as const, label: "Legal Review", icon: Scale },
  { key: "comparison" as const, label: "Comparison", icon: GitCompare },
];

export default function Home() {
  const { activeTab, setActiveTab, tenants, isLoading } = useDashboardStore();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Marcus Garvey AR Dashboard</h1>
            </div>
            <nav className="flex gap-1">
              {tabs.map((tab) => (
                <Button
                  key={tab.key}
                  variant={activeTab === tab.key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab(tab.key)}
                >
                  <tab.icon className="h-4 w-4 mr-1.5" />
                  {tab.label}
                </Button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* File Upload */}
        <FileUpload />

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground">Processing files...</span>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === "dashboard" && tenants.length > 0 && (
          <>
            <SummaryCards />
            <div>
              <h2 className="text-lg font-semibold mb-3">Tenant Overview</h2>
              <RiskFilter />
            </div>
            <TenantTable />
          </>
        )}

        {activeTab === "legal" && <LegalReview />}

        {activeTab === "comparison" && <ComparisonMode />}
      </main>
    </div>
  );
}
