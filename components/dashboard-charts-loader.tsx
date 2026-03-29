"use client";

import dynamic from "next/dynamic";

const DashboardCharts = dynamic(
  () => import("@/components/dashboard-charts").then((mod) => ({ default: mod.DashboardCharts })),
  {
    ssr: false,
    loading: () => <p className="text-sm text-muted-foreground">Carregando dashboard...</p>,
  }
);

export function DashboardChartsLoader() {
  return <DashboardCharts />;
}
