export type EstadoVenta = "pendiente" | "pagado" | "cancelado";

const estilos: Record<EstadoVenta, string> = {
  pendiente: "bg-[#fff0cd] text-[#805114] ring-[#f2dca7]",
  pagado: "bg-[#dff3e7] text-[#246547] ring-[#bce5cd]",
  cancelado: "bg-[#edf0ed] text-[#657471] ring-[#d8dfdb]",
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
