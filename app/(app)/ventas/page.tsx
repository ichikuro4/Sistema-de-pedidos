"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { dinero, EstadoBadge, fecha, type EstadoVenta } from "@/components/venta-presentacion";
import { mensajeError } from "@/lib/mensajes-error";

type VentaResumen = {
  id: string;
  folio: string;
  fecha: string;
  cliente_nombre: string;
  cliente_telefono: string;
  total: number;
  pagado: number;
  saldo: number;
  estado: EstadoVenta;
};

const porPagina = 20;
const campo = "ui-input mt-1.5 text-sm";

export default function VentasPage() {
  const router = useRouter();
  const toast = useToast();
  const [supabase] = useState(createClient);
  const [estado, setEstado] = useState<"todas" | EstadoVenta>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [pagina, setPagina] = useState(0);
  const [ventas, setVentas] = useState<VentaResumen[]>([]);
  const [cantidad, setCantidad] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const temporizador = window.setTimeout(() => setBusquedaAplicada(busqueda.trim()), 350);
    return () => window.clearTimeout(temporizador);
  }, [busqueda]);

  useEffect(() => {
    let activo = true;
    async function cargar() {
      setCargando(true);
      setError(null);
      try {
      let consulta = supabase
        .from("saldo_por_venta")
        .select("id, folio, fecha, cliente_nombre, cliente_telefono, total, pagado, saldo, estado", { count: "exact" })
        .order("fecha", { ascending: false })
        .order("id", { ascending: false });
      if (estado !== "todas") consulta = consulta.eq("estado", estado);
      if (busquedaAplicada) {
        // Las comillas preservan espacios y comas dentro del valor PostgREST.
        const termino = busquedaAplicada.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        consulta = consulta.or(`cliente_nombre.ilike."%${termino}%",cliente_telefono.ilike."%${termino}%"`);
      }
      if (desde) consulta = consulta.gte("fecha", `${desde}T00:00:00-05:00`);
      if (hasta) {
        const diaSiguiente = new Date(`${hasta}T00:00:00Z`);
        diaSiguiente.setUTCDate(diaSiguiente.getUTCDate() + 1);
        consulta = consulta.lt("fecha", `${diaSiguiente.toISOString().slice(0, 10)}T00:00:00-05:00`);
      }
      const { data, count, error: consultaError } = await consulta.range(pagina * porPagina, (pagina + 1) * porPagina - 1);
      if (!activo) return;
      if (consultaError) {
        const mensaje = mensajeError(consultaError, "No se pudieron cargar las ventas. Inténtalo de nuevo.");
        setError(mensaje);
        toast("error", mensaje);
        setVentas([]);
        setCantidad(0);
      } else {
        setVentas((data ?? []) as VentaResumen[]);
        setCantidad(count ?? 0);
      }
      } catch (fallo) {
        if (activo) {
          const mensaje = mensajeError(fallo, "No se pudieron cargar las ventas. Inténtalo de nuevo.");
          setError(mensaje);
          toast("error", mensaje);
          setVentas([]);
          setCantidad(0);
        }
      } finally {
        if (activo) setCargando(false);
      }
    }
    void cargar();
    return () => { activo = false; };
  }, [supabase, estado, busquedaAplicada, desde, hasta, pagina, toast]);

  const paginas = Math.max(1, Math.ceil(cantidad / porPagina));

  return (
    <div className="mx-auto max-w-7xl pb-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="ui-eyebrow">Tu negocio al día</p>
          <h1 className="ui-title mt-2">Ventas</h1>
          <p className="ui-muted mt-2 text-sm">Encuentra pedidos, revisa saldos y continúa atendiendo.</p>
        </div>
        <Link href="/ventas/nueva" className="ui-primary w-full sm:w-auto"><span className="text-lg leading-none">＋</span> Nueva venta</Link>
      </header>

      <section aria-label="Filtros de ventas" className="ui-panel mt-7 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:p-5">
        <label className="text-sm font-medium text-slate-700">Estado
          <select value={estado} onChange={(e) => { setEstado(e.target.value as typeof estado); setPagina(0); }} className={`mt-1.5 ${campo}`}>
            <option value="todas">Todas</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagado">Pagado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Cliente o teléfono
          <input type="search" value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPagina(0); }} placeholder="Buscar venta" className={`mt-1.5 ${campo}`} />
        </label>
        <label className="text-sm font-medium text-slate-700">Desde
          <input type="date" value={desde} max={hasta || undefined} onChange={(e) => { setDesde(e.target.value); setPagina(0); }} className={`mt-1.5 ${campo}`} />
        </label>
        <label className="text-sm font-medium text-slate-700">Hasta
          <input type="date" value={hasta} min={desde || undefined} onChange={(e) => { setHasta(e.target.value); setPagina(0); }} className={`mt-1.5 ${campo}`} />
        </label>
      </section>

      <section className="ui-panel mt-5 overflow-hidden">
        <div className="ui-muted flex items-center justify-between border-b border-[#e1e8e3] px-4 py-4 text-sm sm:px-5">
          <span>{cargando ? "Cargando ventas…" : `${cantidad} ${cantidad === 1 ? "venta" : "ventas"}`}</span>
          <span>Más recientes primero</span>
        </div>
        {error ? (
          <p role="alert" className="p-6 text-sm text-rose-700">{error}</p>
        ) : (
          <>
          <div className="divide-y divide-[#e1e8e3] md:hidden">
            {!cargando && ventas.length === 0 && <p className="ui-muted px-5 py-12 text-center text-sm">No hay ventas con estos filtros.</p>}
            {ventas.map((venta) => <Link key={venta.id} href={`/ventas/${venta.id}`} className="block p-4 transition-colors hover:bg-[#f4faf6] focus-visible:outline-2 focus-visible:outline-[#17636b]">
              <div className="flex items-start justify-between gap-3"><div><p className="ui-eyebrow">{venta.folio}</p><h2 className="mt-1 font-bold text-[#203338]">{venta.cliente_nombre}</h2><p className="ui-muted mt-1 text-xs">{fecha(venta.fecha)} · {venta.cliente_telefono}</p></div><EstadoBadge estado={venta.estado} /></div>
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[#f1f6f2] p-3 text-sm"><div><p className="ui-muted text-xs">Total</p><p className="mt-1 font-semibold">{dinero(venta.total)}</p></div><div><p className="ui-muted text-xs">Pagado</p><p className="mt-1 font-semibold">{dinero(venta.pagado)}</p></div><div><p className="text-xs text-[#94621d]">Saldo</p><p className="mt-1 font-bold text-[#805114]">{dinero(venta.saldo)}</p></div></div>
            </Link>)}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="ui-table min-w-[930px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Folio", "Fecha", "Cliente", "Teléfono", "Total", "Pagado", "Saldo", "Estado"].map((columna) => <th key={columna} scope="col" className="px-4 py-3 font-semibold">{columna}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!cargando && ventas.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">No hay ventas con estos filtros.</td></tr>}
                {ventas.map((venta) => (
                  <tr key={venta.id} role="link" tabIndex={0} aria-label={`Ver venta ${venta.folio}`} onClick={() => router.push(`/ventas/${venta.id}`)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/ventas/${venta.id}`); } }} className="cursor-pointer hover:bg-slate-50 focus:bg-slate-50 focus:outline-2 focus:outline-slate-600">
                    <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-950">{venta.folio}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">{fecha(venta.fecha)}</td>
                    <td className="px-4 py-4 text-slate-900">{venta.cliente_nombre}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">{venta.cliente_telefono}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-900">{dinero(venta.total)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">{dinero(venta.pagado)}</td>
                    <td className="whitespace-nowrap px-4 py-4 font-medium text-slate-900">{dinero(venta.saldo)}</td>
                    <td className="px-4 py-4"><EstadoBadge estado={venta.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        {!error && cantidad > 0 && (
          <nav aria-label="Paginación de ventas" className="flex items-center justify-between gap-3 border-t border-[#e1e8e3] px-4 py-3 text-sm">
            <button type="button" disabled={pagina === 0 || cargando} onClick={() => setPagina((actual) => actual - 1)} className="ui-soft disabled:opacity-40">Anterior</button>
            <span className="text-center text-slate-600">Página {pagina + 1} de {paginas}</span>
            <button type="button" disabled={pagina + 1 >= paginas || cargando} onClick={() => setPagina((actual) => actual + 1)} className="ui-soft disabled:opacity-40">Siguiente</button>
          </nav>
        )}
      </section>
    </div>
  );
}
