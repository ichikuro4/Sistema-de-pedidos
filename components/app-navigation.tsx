"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PorCobrarBadge } from "@/components/por-cobrar-badge";

const destinos = [
  { href: "/ventas", movil: "Ventas", escritorio: "Ventas", icono: "ventas" },
  { href: "/ventas/nueva", movil: "Nueva", escritorio: "Nueva venta", icono: "nueva" },
  { href: "/clientes", movil: "Clientes", escritorio: "Clientes", icono: "clientes" },
  { href: "/por-cobrar", movil: "Cobrar", escritorio: "Por cobrar", icono: "cobrar" },
  { href: "/reportes", movil: "Reportes", escritorio: "Reportes", icono: "reportes" },
] as const;

function Icono({ tipo }: { tipo: typeof destinos[number]["icono"] }) {
  const comun = { width: 21, height: 21, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (tipo === "ventas") return <svg {...comun}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>;
  if (tipo === "nueva") return <svg {...comun}><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 7v10M7 12h10"/></svg>;
  if (tipo === "clientes") return <svg {...comun}><circle cx="12" cy="8" r="3"/><path d="M5 20v-2a7 7 0 0 1 14 0v2M3 20h18"/></svg>;
  if (tipo === "cobrar") return <svg {...comun}><path d="M4 7h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7ZM4 9h16M7 4h10"/><path d="M15 14h3"/></svg>;
  return <svg {...comun}><path d="M4 20V10M10 20V5M16 20v-8M22 20V8"/><path d="M2 20h20"/></svg>;
}

export function AppNavigation() {
  const ruta = usePathname();
  return (
    <nav aria-label="Menú principal" className="flex justify-around gap-1 px-2 py-2 md:mt-9 md:flex-col md:justify-start md:gap-1.5 md:px-4 md:py-0">
      {destinos.map((destino) => {
        const activo = destino.href === "/ventas" ? ruta === "/ventas" || (ruta.startsWith("/ventas/") && ruta !== "/ventas/nueva") : destino.href === "/clientes" ? ruta.startsWith("/clientes") : ruta === destino.href;
        return (
          <Link key={destino.href} href={destino.href} aria-current={activo ? "page" : undefined}
            className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-bold transition-colors md:w-full md:flex-none md:flex-row md:gap-3 md:px-4 md:py-3 md:text-sm ${activo ? "bg-[#e6f3ee] text-[#155c65]" : "text-[#668083] hover:bg-[#f1f5ef] hover:text-[#254d53]"}`}>
            <Icono tipo={destino.icono} />
            <span className="md:hidden">{destino.movil}</span>
            <span className="hidden md:inline">{destino.escritorio}</span>
            {destino.href === "/por-cobrar" && <span className="absolute right-1 top-0 md:relative md:ml-auto"><PorCobrarBadge /></span>}
          </Link>
        );
      })}
    </nav>
  );
}
