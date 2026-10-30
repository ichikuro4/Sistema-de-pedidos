import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { PorCobrarBadge } from "@/components/por-cobrar-badge";

const navigation = [
  { href: "/ventas", label: "Ventas" },
  { href: "/ventas/nueva", label: "Nueva venta" },
  { href: "/por-cobrar", label: "Por cobrar" },
  { href: "/reportes", label: "Reportes" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white p-5 md:flex md:min-h-screen md:w-64 md:flex-col md:border-b-0 md:border-r">
        <Link href="/ventas" className="block text-lg font-bold text-slate-950">
          WALL y Eva
        </Link>
        <p className="mt-1 text-xs text-slate-500">Panel de ventas</p>
        <nav className="mt-8 flex gap-2 overflow-auto md:block md:space-y-2">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            >
              {item.label}
              {item.href === "/por-cobrar" && <PorCobrarBadge />}
            </Link>
          ))}
        </nav>
        <LogoutButton />
      </aside>
      <main className="flex-1 p-6 md:p-10">{children}</main>
    </div>
  );
}
