"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type DashboardSidebarProps = {
  className?: string;
  onNavigate?: () => void;
};
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  BarChart3,
  Upload,
  LogOut,
  Receipt,
  Boxes,
} from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/produtos", label: "Produtos / SKUs", icon: Package },
  { href: "/estoque", label: "Estoque", icon: Boxes },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/vendas", label: "Vendas", icon: ShoppingCart },
  { href: "/insumos", label: "Insumos", icon: Receipt },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/importar", label: "Importar", icon: Upload },
];

export function DashboardSidebar({ className, onNavigate }: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={cn("flex w-56 shrink-0 flex-col bg-card md:border-r", className)}>
      <div className="hidden p-4 font-semibold md:flex md:items-center md:gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          RV
        </span>
        Reville Fitness
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onNavigate?.()}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm transition-all duration-150",
                active ? "bg-primary text-primary-foreground" : "hover:bg-muted hover:shadow-sm active:scale-[0.98]",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
