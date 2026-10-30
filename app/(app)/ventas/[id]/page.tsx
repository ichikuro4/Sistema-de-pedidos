"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { dinero, EstadoBadge, fecha, type EstadoVenta } from "@/components/venta-presentacion";
import { avanzarConEnter } from "@/lib/formulario-teclado";
import { mensajeError } from "@/lib/mensajes-error";

type Venta = {
  id: string;
  folio: string;
  fecha: string;
  estado: EstadoVenta;
  cliente_nombre: string;
  cliente_telefono: string;
  total: number;
  pagado: number;
  saldo: number;
};
type Item = { id: string; producto_nombre: string; descripcion: string | null; precio: number };
type Pago = { id: string; fecha: string; monto: number; metodo: string; nota: string | null };
type Metodo = "efectivo" | "transferencia" | "otro";

const campo = "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-950 outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-200";

function montoEnCentimos(valor: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(valor)) return null;
  const resultado = Math.round(Number(valor) * 100);
  return Number.isSafeInteger(resultado) ? resultado : null;
}

export default function VentaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const accionActiva = useRef(false);
  const [supabase] = useState(createClient);
  const [venta, setVenta] = useState<Venta | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"pago" | "cancelar" | null>(null);
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<Metodo>("efectivo");
  const [nota, setNota] = useState("");
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let activo = true;
    void Promise.all([
      supabase.from("saldo_por_venta").select("id, folio, fecha, estado, cliente_nombre, cliente_telefono, total, pagado, saldo").eq("id", id).maybeSingle(),
      supabase.from("venta_items").select("id, producto_nombre, descripcion, precio").eq("venta_id", id).order("id"),
      supabase.from("pagos").select("id, fecha, monto, metodo, nota").eq("venta_id", id).order("fecha", { ascending: false }),
    ]).then(([respuestaVenta, respuestaItems, respuestaPagos]) => {
      if (!activo) return;
      if (respuestaVenta.error || respuestaItems.error || respuestaPagos.error) {
        const mensaje = mensajeError(respuestaVenta.error ?? respuestaItems.error ?? respuestaPagos.error, "No se pudo cargar la venta. Inténtalo de nuevo.");
        setError(mensaje);
        toast("error", mensaje);
        setVenta(null);
      } else {
        setError(null);
        setVenta(respuestaVenta.data as Venta | null);
        setItems((respuestaItems.data ?? []) as Item[]);
        setPagos((respuestaPagos.data ?? []) as Pago[]);
      }
      setCargando(false);
    }).catch((fallo: unknown) => {
      if (!activo) return;
      const mensaje = mensajeError(fallo, "No se pudo cargar la venta. Inténtalo de nuevo.");
      setError(mensaje);
      toast("error", mensaje);
      setVenta(null);
      setCargando(false);
    });
    return () => { activo = false; };
  }, [supabase, id, recarga, toast]);

  async function agregarPago(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!venta || venta.estado !== "pendiente" || accionActiva.current || cargando) return;
    const centimos = montoEnCentimos(monto);
    const saldoCentimos = Math.round(Number(venta.saldo) * 100);
    if (centimos === null || centimos <= 0 || centimos > saldoCentimos) {
      toast("error", "El monto debe ser mayor que cero y no superar el saldo pendiente. Usa hasta dos decimales.");
      return;
    }
    accionActiva.current = true;
    setOcupado(true);
    try {
      const { error: rpcError } = await supabase.rpc("agregar_pago", {
        p_venta_id: id,
        p_monto: centimos / 100,
        p_metodo: metodo,
        p_nota: nota.trim() || null,
      });
      if (rpcError) throw rpcError;
      setModal(null);
      setMonto("");
      setMetodo("efectivo");
      setNota("");
      toast("exito", "Pago agregado correctamente.");
      setCargando(true);
      setRecarga((actual) => actual + 1);
    } catch (error) {
      toast("error", mensajeError(error, "No se pudo agregar el pago. Inténtalo de nuevo."));
    } finally {
      accionActiva.current = false;
      setOcupado(false);
    }
  }

  async function cancelarVenta() {
    if (!venta || venta.estado === "cancelado" || accionActiva.current || cargando) return;
    accionActiva.current = true;
    setOcupado(true);
    try {
      const { error: rpcError } = await supabase.rpc("cancelar_venta", { p_venta_id: id });
      if (rpcError) throw rpcError;
      setModal(null);
      toast("exito", "Venta cancelada correctamente.");
      setCargando(true);
      setRecarga((actual) => actual + 1);
    } catch (error) {
      toast("error", mensajeError(error, "No se pudo cancelar la venta. Inténtalo de nuevo."));
    } finally {
      accionActiva.current = false;
      setOcupado(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl pb-12">
      <Link href="/ventas" className="inline-flex rounded-lg py-2 text-sm font-semibold text-slate-700 hover:text-slate-950">← Volver a ventas</Link>
      {error && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {cargando && !venta && <p className="mt-8 text-sm text-slate-600">Cargando venta…</p>}
      {!cargando && !error && !venta && <p className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-slate-600">No se encontró esta venta.</p>}
      {venta && (
        <>
          <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Detalle de venta</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-950">{venta.folio}</h1>
              <p className="mt-2 text-sm text-slate-600">{fecha(venta.fecha)}</p>
            </div>
            <EstadoBadge estado={venta.estado} />
          </header>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-950">Cliente</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><dt className="text-sm text-slate-500">Nombre</dt><dd className="mt-1 font-medium text-slate-900">{venta.cliente_nombre}</dd></div>
              <div><dt className="text-sm text-slate-500">Teléfono</dt><dd className="mt-1 font-medium text-slate-900"><a href={`tel:${venta.cliente_telefono}`} className="hover:underline">{venta.cliente_telefono}</a></dd></div>
            </dl>
          </section>

          <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h2 className="px-5 py-4 text-lg font-semibold text-slate-950 sm:px-6">Figuras</h2>
            <div className="overflow-x-auto">
              <table className="min-w-[550px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th scope="col" className="px-5 py-3 font-semibold sm:px-6">Producto</th><th scope="col" className="px-5 py-3 font-semibold">Descripción</th><th scope="col" className="px-5 py-3 text-right font-semibold sm:px-6">Precio</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => <tr key={item.id}><td className="px-5 py-4 font-medium text-slate-900 sm:px-6">{item.producto_nombre}</td><td className="px-5 py-4 text-slate-600">{item.descripcion || "—"}</td><td className="whitespace-nowrap px-5 py-4 text-right text-slate-900 sm:px-6">{dinero(item.precio)}</td></tr>)}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-950">Resumen</h2>
            <dl className="mt-4 space-y-3">
              <div className="flex justify-between gap-4 text-sm"><dt className="text-slate-600">Total</dt><dd className="font-medium text-slate-900">{dinero(venta.total)}</dd></div>
              <div className="flex justify-between gap-4 text-sm"><dt className="text-slate-600">Pagado</dt><dd className="font-medium text-slate-900">{dinero(venta.pagado)}</dd></div>
              <div className="flex justify-between gap-4 border-t border-slate-200 pt-4 text-lg font-bold"><dt className="text-slate-950">Saldo pendiente</dt><dd className="text-amber-800">{dinero(venta.saldo)}</dd></div>
            </dl>
          </section>

          <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h2 className="px-5 py-4 text-lg font-semibold text-slate-950 sm:px-6">Pagos</h2>
            {pagos.length === 0 ? <p className="border-t border-slate-100 px-5 py-5 text-sm text-slate-500 sm:px-6">Aún no hay pagos registrados.</p> : (
              <div className="overflow-x-auto">
                <table className="min-w-[600px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th scope="col" className="px-5 py-3 font-semibold sm:px-6">Fecha</th><th scope="col" className="px-5 py-3 font-semibold">Monto</th><th scope="col" className="px-5 py-3 font-semibold">Método</th><th scope="col" className="px-5 py-3 font-semibold sm:px-6">Nota</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagos.map((pago) => <tr key={pago.id}><td className="whitespace-nowrap px-5 py-4 text-slate-600 sm:px-6">{fecha(pago.fecha)}</td><td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900">{dinero(pago.monto)}</td><td className="px-5 py-4 capitalize text-slate-700">{pago.metodo}</td><td className="px-5 py-4 text-slate-600 sm:px-6">{pago.nota || "—"}</td></tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="mt-6 flex flex-wrap gap-3">
            {venta.estado === "pendiente" && <button type="button" disabled={cargando} onClick={() => setModal("pago")} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">Agregar pago</button>}
            {venta.estado !== "cancelado" && <button type="button" disabled={cargando} onClick={() => setModal("cancelar")} className="rounded-xl border border-rose-300 px-5 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Cancelar venta</button>}
          </div>
        </>
      )}

      {modal && venta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          {modal === "pago" ? (
            <div role="dialog" aria-modal="true" aria-labelledby="titulo-pago" onKeyDown={(e) => { if (e.key === "Escape" && !ocupado) setModal(null); }} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
              <h2 id="titulo-pago" className="text-xl font-bold text-slate-950">Agregar pago</h2>
              <p className="mt-2 text-sm text-slate-600">Saldo disponible: {dinero(venta.saldo)}</p>
              <form onSubmit={agregarPago} onKeyDown={avanzarConEnter} className="mt-5 space-y-4">
                <label className="block text-sm font-medium text-slate-700">Monto (S/)
                  <input autoFocus className={campo} type="number" inputMode="decimal" min="0.01" max={Number(venta.saldo)} step="0.01" required value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" />
                </label>
                <label className="block text-sm font-medium text-slate-700">Método
                  <select className={campo} value={metodo} onChange={(e) => setMetodo(e.target.value as Metodo)}><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="otro">Otro</option></select>
                </label>
                <label className="block text-sm font-medium text-slate-700">Nota
                  <textarea className={campo} rows={3} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Opcional" />
                </label>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" disabled={ocupado} onClick={() => setModal(null)} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 disabled:opacity-50">Cerrar</button>
                  <button type="submit" disabled={ocupado} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{ocupado ? "Guardando…" : "Guardar pago"}</button>
                </div>
              </form>
            </div>
          ) : (
            <div role="dialog" aria-modal="true" aria-labelledby="titulo-cancelar" onKeyDown={(e) => { if (e.key === "Escape" && !ocupado) setModal(null); }} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
              <h2 id="titulo-cancelar" className="text-xl font-bold text-slate-950">Cancelar venta</h2>
              <p className="mt-3 text-sm text-slate-700">¿Confirmas la cancelación de la venta {venta.folio}?</p>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" autoFocus disabled={ocupado} onClick={() => setModal(null)} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 disabled:opacity-50">Volver</button>
                <button type="button" disabled={ocupado} onClick={cancelarVenta} className="rounded-xl bg-rose-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{ocupado ? "Cancelando…" : "Cancelar venta"}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
