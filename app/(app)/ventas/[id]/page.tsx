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
  cliente_id: string;
  total: number;
  pagado: number;
  saldo: number;
};
type Item = { id: string; producto_nombre: string; descripcion: string | null; precio: number };
type Pago = { id: string; fecha: string; monto: number; metodo: string; nota: string | null };
type Metodo = "efectivo" | "transferencia" | "otro";

const campo = "ui-input mt-1.5 text-base";

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
      supabase.from("saldo_por_venta").select("id, folio, fecha, estado, cliente_nombre, cliente_telefono, cliente_id, total, pagado, saldo").eq("id", id).maybeSingle(),
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
      <Link href="/ventas" className="ui-soft">← Volver a ventas</Link>
      {error && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {cargando && !venta && <p className="mt-8 text-sm text-slate-600">Cargando venta…</p>}
      {!cargando && !error && !venta && <p className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-slate-600">No se encontró esta venta.</p>}
      {venta && (
        <>
          <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="ui-eyebrow">Detalle de venta</p>
              <h1 className="ui-title mt-2">{venta.folio}</h1>
              <p className="mt-2 text-sm text-slate-600">{fecha(venta.fecha)}</p>
            </div>
            <EstadoBadge estado={venta.estado} />
          </header>

          <section className="ui-panel mt-6 p-5 sm:p-6">
            <h2 className="ui-section-title">Cliente</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><dt className="text-sm text-slate-500">Nombre</dt><dd className="mt-1 font-medium text-slate-900">{venta.cliente_nombre}</dd></div>
              <div><dt className="text-sm text-slate-500">Teléfono</dt><dd className="mt-1 font-medium text-slate-900"><a href={`tel:${venta.cliente_telefono}`} className="font-bold text-[#17636b] underline underline-offset-2">{venta.cliente_telefono}</a></dd></div>
            </dl>
            <Link href={`/clientes/${venta.cliente_id}`} className="ui-soft mt-5">Ver historial del cliente →</Link>
          </section>

          <section className="ui-panel mt-5 overflow-hidden">
            <h2 className="ui-section-title px-5 py-4 sm:px-6">Figuras</h2>
            <div className="divide-y divide-[#e1e8e3] border-t border-[#e1e8e3] md:hidden">{items.map((item) => <div key={item.id} className="flex items-start justify-between gap-4 p-5"><div><h3 className="font-bold text-[#203338]">{item.producto_nombre}</h3><p className="ui-muted mt-1 text-sm">{item.descripcion || "—"}</p></div><strong className="shrink-0 text-[#17636b]">{dinero(item.precio)}</strong></div>)}</div>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[550px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th scope="col" className="px-5 py-3 font-semibold sm:px-6">Producto</th><th scope="col" className="px-5 py-3 font-semibold">Descripción</th><th scope="col" className="px-5 py-3 text-right font-semibold sm:px-6">Precio</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => <tr key={item.id}><td className="px-5 py-4 font-medium text-slate-900 sm:px-6">{item.producto_nombre}</td><td className="px-5 py-4 text-slate-600">{item.descripcion || "—"}</td><td className="whitespace-nowrap px-5 py-4 text-right text-slate-900 sm:px-6">{dinero(item.precio)}</td></tr>)}
                </tbody>
              </table>
            </div>
          </section>

          <section className="ui-panel mt-5 p-5 sm:p-6">
            <h2 className="ui-section-title">Resumen</h2>
            <dl className="mt-4 space-y-3">
              <div className="flex justify-between gap-4 text-sm"><dt className="text-slate-600">Total</dt><dd className="font-medium text-slate-900">{dinero(venta.total)}</dd></div>
              <div className="flex justify-between gap-4 text-sm"><dt className="text-slate-600">Pagado</dt><dd className="font-medium text-slate-900">{dinero(venta.pagado)}</dd></div>
              <div className="flex justify-between gap-4 border-t border-[#e1e8e3] pt-4 text-lg font-bold"><dt className="text-[#203338]">Saldo pendiente</dt><dd className="text-[#805114]">{dinero(venta.saldo)}</dd></div>
            </dl>
            {venta.estado !== "cancelado" && <div className="mt-5 flex flex-wrap gap-3 border-t border-[#e1e8e3] pt-5">
              {venta.estado === "pendiente" && <button type="button" disabled={cargando || ocupado} onClick={() => setModal("pago")} className="ui-primary w-full shadow-md sm:w-auto">+ Agregar pago</button>}
              <button type="button" disabled={cargando || ocupado} onClick={() => setModal("cancelar")} className="ui-outline w-full sm:w-auto">Cancelar venta</button>
            </div>}
          </section>

          <section className="ui-panel mt-5 overflow-hidden">
            <h2 className="ui-section-title px-5 py-4 sm:px-6">Pagos</h2>
            {pagos.length === 0 ? <p className="border-t border-slate-100 px-5 py-5 text-sm text-slate-500 sm:px-6">Aún no hay pagos registrados.</p> : (
              <><div className="divide-y divide-[#e1e8e3] border-t border-[#e1e8e3] md:hidden">{pagos.map((pago) => <div key={pago.id} className="flex items-start justify-between gap-3 p-5"><div><p className="text-sm font-semibold capitalize text-[#203338]">{pago.metodo}</p><p className="ui-muted mt-1 text-xs">{fecha(pago.fecha)}</p>{pago.nota && <p className="ui-muted mt-2 text-sm">{pago.nota}</p>}</div><strong className="text-[#17636b]">{dinero(pago.monto)}</strong></div>)}</div><div className="hidden overflow-x-auto md:block">
                <table className="min-w-[600px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th scope="col" className="px-5 py-3 font-semibold sm:px-6">Fecha</th><th scope="col" className="px-5 py-3 font-semibold">Monto</th><th scope="col" className="px-5 py-3 font-semibold">Método</th><th scope="col" className="px-5 py-3 font-semibold sm:px-6">Nota</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagos.map((pago) => <tr key={pago.id}><td className="whitespace-nowrap px-5 py-4 text-slate-600 sm:px-6">{fecha(pago.fecha)}</td><td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900">{dinero(pago.monto)}</td><td className="px-5 py-4 capitalize text-slate-700">{pago.metodo}</td><td className="px-5 py-4 text-slate-600 sm:px-6">{pago.nota || "—"}</td></tr>)}
                  </tbody>
                </table>
              </div></>
            )}
          </section>

        </>
      )}

      {modal && venta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          {modal === "pago" ? (
            <div role="dialog" aria-modal="true" aria-labelledby="titulo-pago" onKeyDown={(e) => { if (e.key === "Escape" && !ocupado) setModal(null); }} className="ui-panel w-full max-w-md p-5 shadow-2xl sm:p-6">
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
                  <button type="button" disabled={ocupado} onClick={() => setModal(null)} className="ui-soft">Cerrar</button>
                  <button type="submit" disabled={ocupado} className="ui-primary">{ocupado ? "Guardando…" : "Guardar pago"}</button>
                </div>
              </form>
            </div>
          ) : (
            <div role="dialog" aria-modal="true" aria-labelledby="titulo-cancelar" onKeyDown={(e) => { if (e.key === "Escape" && !ocupado) setModal(null); }} className="ui-panel w-full max-w-md p-5 shadow-2xl sm:p-6">
              <h2 id="titulo-cancelar" className="text-xl font-bold text-slate-950">Cancelar venta</h2>
              <p className="mt-3 text-sm text-slate-700">¿Confirmas la cancelación de la venta {venta.folio}?</p>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" autoFocus disabled={ocupado} onClick={() => setModal(null)} className="ui-soft">Volver</button>
                <button type="button" disabled={ocupado} onClick={cancelarVenta} className="ui-danger">{ocupado ? "Cancelando…" : "Cancelar venta"}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
