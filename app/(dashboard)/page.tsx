import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardChartsLoader } from "@/components/dashboard-charts-loader";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Faturamento e lucro por período semanal, mensal ou anual, com comparativo ao período anterior.
        </p>
      </div>
      <DashboardChartsLoader />
    </div>
  );
}
