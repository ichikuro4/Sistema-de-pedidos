"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { dinero, fecha, type EstadoVenta } from "@/components/venta-presentacion";
import { mensajeError } from "@/lib/mensajes-error";

type VentaReporte = {
  id: string;
  folio: string;
  fecha: string;
  cliente_nombre: string;
  cliente_telefono: string;
  total: number;
  estado: EstadoVenta;
};
type PagoReporte = {
  id: string;
  fecha: string;
  monto: number;
  metodo: string;
  ventas: { folio: string };
};
type Pendiente = { id: string; saldo: number };
type Datos = { ventas: VentaReporte[]; pagos: PagoReporte[]; pendientes: Pendiente[] };
type Respuesta = { data: unknown; count: number | null; error: { message: string } | null };

const zona = "America/Lima";
const formatoDia = new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" });
const campo = "ui-input mt-1.5 text-sm";

function diaLima(valor: Date | string) {
  const partes = Object.fromEntries(formatoDia.formatToParts(new Date(valor)).map(({ type, value }) => [type, value]));
  return `${partes.year}-${partes.month}-${partes.day}`;
}

function mesActual() {
  const hoy = diaLima(new Date());
  const [anio, mes] = hoy.split("-").map(Number);
  return { desde: `${hoy.slice(0, 7)}-01`, hasta: `${hoy.slice(0, 7)}-${String(new Date(Date.UTC(anio, mes, 0)).getUTCDate()).padStart(2, "0")}` };
}

function siguienteDia(valor: string) {
  const dia = new Date(`${valor}T00:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() + 1);
  return dia.toISOString().slice(0, 10);
}

async function traerTodas<T>(consultar: (inicio: number, fin: number) => PromiseLike<Respuesta>): Promise<T[]> {
  const filas: T[] = [];
  while (true) {
    const { data, count, error } = await consultar(filas.length, filas.length + 999);
    if (error) throw new Error(error.message);
    const lote = (data ?? []) as T[];
    filas.push(...lote);
    if (lote.length === 0 || filas.length >= (count ?? filas.length)) return filas;
  }
}

function centimos(valor: number) {
  return Math.round(Number(valor) * 100);
}

function descargarCsv(nombre: string, encabezados: string[], filas: (string | number)[][]) {
  const escapar = (valor: string | number) => {
    const texto = String(valor);
    // Evita que Excel interprete datos del cliente como fórmulas.
    const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
    return `"${seguro.replace(/"/g, '""')}"`;
  };
  const contenido = "\uFEFF" + [encabezados, ...filas].map((fila) => fila.map(escapar).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function ReportesPage() {
  const toast = useToast();
  const [supabase] = useState(createClient);
  const [inicial] = useState(mesActual);
  const [desde, setDesde] = useState(inicial.desde);
  const [hasta, setHasta] = useState(inicial.hasta);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [exportando, setExportando] = useState<"ventas" | "pagos" | null>(null);
  const rangoValido = Boolean(desde && hasta && desde <= hasta);

  useEffect(() => {
    if (!rangoValido) return;
    let activo = true;
    const inicio = `${desde}T00:00:00-05:00`;
    const fin = `${siguienteDia(hasta)}T00:00:00-05:00`;
    async function cargar() {
      try {
        const [ventas, pagos, pendientes] = await Promise.all([
          traerTodas<VentaReporte>((a, b) => supabase.from("ventas")
            .select("id, folio, fecha, cliente_nombre, cliente_telefono, total, estado", { count: "exact" })
            .gte("fecha", inicio).lt("fecha", fin).order("fecha").order("id").range(a, b)),
          traerTodas<PagoReporte>((a, b) => supabase.from("pagos")
            .select("id, fecha, monto, metodo, ventas!inner(folio)", { count: "exact" })
            .gte("fecha", inicio).lt("fecha", fin).order("fecha").order("id").range(a, b)),
          traerTodas<Pendiente>((a, b) => supabase.from("por_cobrar")
            .select("id, saldo", { count: "exact" }).order("id").range(a, b)),
        ]);
        if (activo) {
          setDatos({ ventas, pagos, pendientes });
          setError(null);
        }
      } catch (fallo) {
        if (activo) {
          const mensaje = mensajeError(fallo, "No se pudieron cargar los reportes. Inténtalo de nuevo.");
          setError(mensaje);
          toast("error", mensaje);
        }
      } finally {
        if (activo) setCargando(false);
      }
    }
    void cargar();
    return () => { activo = false; };
  }, [supabase, desde, hasta, rangoValido, toast]);

  async function exportar(tipo: "ventas" | "pagos") {
    if (exportando || !datos) return;
    setExportando(tipo);
    await new Promise<void>((resolver) => window.requestAnimationFrame(() => resolver()));
    try {
      if (tipo === "ventas") {
        descargarCsv(`ventas_${desde}_${hasta}.csv`, ["Folio", "Fecha", "Cliente", "Teléfono", "Total", "Estado"], datos.ventas.map((venta) => [venta.folio, fecha(venta.fecha), venta.cliente_nombre, venta.cliente_telefono, Number(venta.total).toFixed(2), venta.estado]));
      } else {
        descargarCsv(`pagos_${desde}_${hasta}.csv`, ["Folio de venta", "Fecha", "Monto", "Método"], datos.pagos.map((pago) => [pago.ventas.folio, fecha(pago.fecha), Number(pago.monto).toFixed(2), pago.metodo]));
      }
      toast("exito", "Archivo CSV descargado.");
    } catch (fallo) {
      toast("error", mensajeError(fallo, "No se pudo descargar el CSV. Inténtalo de nuevo."));
    } finally {
      setExportando(null);
    }
  }

  const ventas = datos?.ventas ?? [];
  const pagos = datos?.pagos ?? [];
  const totalVendido = ventas.filter((venta) => venta.estado !== "cancelado").reduce((suma, venta) => suma + centimos(venta.total), 0) / 100;
  const totalCobrado = pagos.reduce((suma, pago) => suma + centimos(pago.monto), 0) / 100;
  const totalPorCobrar = (datos?.pendientes ?? []).reduce((suma, venta) => suma + centimos(venta.saldo), 0) / 100;
  const estados = {
    pendiente: ventas.filter((venta) => venta.estado === "pendiente").length,
    pagado: ventas.filter((venta) => venta.estado === "pagado").length,
    cancelado: ventas.filter((venta) => venta.estado === "cancelado").length,
  };

  const porDia = new Map<string, number>();
  for (const venta of ventas) {
    if (venta.estado === "cancelado") continue;
    const dia = diaLima(venta.fecha);
    porDia.set(dia, (porDia.get(dia) ?? 0) + centimos(venta.total));
  }
  const dias: { dia: string; monto: number }[] = [];
  if (rangoValido) {
    const cursor = new Date(`${desde}T00:00:00Z`);
    const ultimo = new Date(`${hasta}T00:00:00Z`);
    while (cursor <= ultimo) {
      const dia = cursor.toISOString().slice(0, 10);
      dias.push({ dia, monto: (porDia.get(dia) ?? 0) / 100 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  const maximo = dias.reduce((maximoActual, dia) => Math.max(maximoActual, dia.monto), 1);
  const diaActivo = dias.find((dia) => dia.dia === diaSeleccionado);
  const visible = rangoValido && !cargando && !error && datos;

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <header>
        <p className="ui-eyebrow">Una vista clara del negocio</p>
        <h1 className="ui-title mt-2">Reportes</h1>
        <p className="ui-muted mt-2 text-sm">Revisa lo vendido y cobrado en el periodo que elijas.</p>
      </header>

      <section aria-label="Rango del reporte" className="ui-panel mt-7 grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
        <label className="text-sm font-medium text-slate-700">Desde
          <input className={campo} type="date" value={desde} max={hasta || undefined} onChange={(e) => { setDesde(e.target.value); setCargando(true); }} />
        </label>
        <label className="text-sm font-medium text-slate-700">Hasta
          <input className={campo} type="date" value={hasta} min={desde || undefined} onChange={(e) => { setHasta(e.target.value); setCargando(true); }} />
        </label>
      </section>
      {!rangoValido && <p role="alert" className="mt-4 text-sm text-rose-700">Selecciona un rango de fechas válido.</p>}
      {rangoValido && cargando && <p className="mt-6 text-sm text-slate-600">Cargando reportes…</p>}
      {rangoValido && !cargando && error && <p role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}

      {visible && (
        <>
          <section aria-label="Resumen" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { titulo: "Total vendido", valor: dinero(totalVendido), ayuda: "Ventas no canceladas del rango" },
              { titulo: "Total cobrado", valor: dinero(totalCobrado), ayuda: "Pagos recibidos en el rango" },
              { titulo: "Total por cobrar", valor: dinero(totalPorCobrar), ayuda: "Saldo pendiente de todas las fechas" },
            ].map((tarjeta) => (
              <div key={tarjeta.titulo} className="ui-panel border-t-4 border-t-[#f1b457] p-5">
                <h2 className="ui-muted text-sm font-medium">{tarjeta.titulo}</h2>
                <p className="mt-2 text-2xl font-extrabold tracking-tight text-[#203338]">{tarjeta.valor}</p>
                <p className="ui-muted mt-1 text-xs">{tarjeta.ayuda}</p>
              </div>
            ))}
          </section>
          <section aria-label="Cantidad de ventas" className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { titulo: "Ventas en el rango", valor: ventas.length },
              { titulo: "Pendientes", valor: estados.pendiente },
              { titulo: "Pagadas", valor: estados.pagado },
              { titulo: "Canceladas", valor: estados.cancelado },
            ].map((tarjeta) => (
              <div key={tarjeta.titulo} className="ui-panel p-4">
                <h2 className="ui-muted text-sm">{tarjeta.titulo}</h2>
                <p className="mt-1 text-2xl font-extrabold text-[#203338]">{tarjeta.valor}</p>
              </div>
            ))}
          </section>

          <section className="ui-panel mt-6 p-4 sm:p-6">
            <h2 className="ui-section-title">Ventas por día</h2>
            <p className="mt-1 text-xs text-slate-500">Monto de ventas no canceladas. Desliza para ver más días.</p>
            <div className="mt-5 overflow-x-auto">
              <ol className="flex h-48 items-end gap-1 border-b border-slate-200 pb-2" style={{ minWidth: Math.max(480, dias.length * 34) }}>
                {dias.map(({ dia, monto }) => (
                  <li key={dia} className="h-full min-w-7 flex-1">
                    <button type="button" onClick={() => setDiaSeleccionado(dia)} title={`${dia}: ${dinero(monto)}`} aria-label={`${dia}: ${dinero(monto)}`} className="flex h-full w-full flex-col items-center justify-end gap-1 rounded focus:outline-2 focus:outline-[#17636b]">
                      <span className={`w-full rounded-t ${diaSeleccionado === dia ? "bg-[#f1b457]" : "bg-[#3c918e]"}`} style={{ height: monto > 0 ? Math.max(3, Math.round((monto / maximo) * 148)) : 0 }} />
                      <span className="text-[10px] text-slate-500">{dia.slice(8, 10)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            <p className="mt-2 text-xs text-slate-500">{diaActivo ? `${diaActivo.dia}: ${dinero(diaActivo.monto)}` : "Cada número indica el día del mes. Toca una barra para ver su monto."}</p>
          </section>

          <section aria-label="Exportaciones CSV" className="ui-panel mt-6 p-4 sm:p-6">
            <h2 className="ui-section-title">Descargar datos</h2>
            <p className="ui-muted mt-1 text-sm">Guarda una copia de las ventas o pagos del periodo seleccionado.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button type="button" disabled={exportando !== null} onClick={() => void exportar("ventas")} className="ui-primary w-full sm:w-auto"><span aria-hidden="true">↓</span>{exportando === "ventas" ? "Preparando CSV…" : "Exportar ventas a CSV"}</button>
              <button type="button" disabled={exportando !== null} onClick={() => void exportar("pagos")} className="ui-outline w-full sm:w-auto"><span aria-hidden="true">↓</span>{exportando === "pagos" ? "Preparando CSV…" : "Exportar pagos a CSV"}</button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
