export type EstadoVenta = "pendiente" | "pagado" | "cancelado";

const estilos: Record<EstadoVenta, string> = {
  pendiente: "bg-amber-100 text-amber-800 ring-amber-200",
  pagado: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  cancelado: "bg-slate-100 text-slate-600 ring-slate-200",
};

const formatoDinero = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const formatoFecha = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" });

export function dinero(valor: number | string | null | undefined) {
  return formatoDinero.format(Number(valor ?? 0));
}

export function fecha(valor: string) {
  return formatoFecha.format(new Date(valor));
}

export function EstadoBadge({ estado }: { estado: EstadoVenta }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${estilos[estado]}`}>{estado}</span>;
}
