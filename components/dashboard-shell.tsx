"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 md:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <BrandLogo className="min-w-0 flex-1" />
      </header>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <DashboardSidebar
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[min(100%,16rem)] transition-transform duration-200 ease-out md:static md:z-0 md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          "top-14 h-[calc(100dvh-3.5rem)] border-r md:top-0 md:h-auto md:min-h-screen",
        )}
        onNavigate={() => setMobileOpen(false)}
      />

      <main className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto p-4 pb-8 md:p-6">
        {children}
      </main>
    </div>
  );
}
