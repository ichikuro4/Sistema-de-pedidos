"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { dinero, EstadoBadge, fecha, type EstadoVenta } from "@/components/venta-presentacion";
import { mensajeError } from "@/lib/mensajes-error";
import { avanzarConEnter } from "@/lib/formulario-teclado";

type Cliente = { id: string; nombre: string; telefono: string };
type Compra = { id: string; folio: string; fecha: string; estado: EstadoVenta; total: number; pagado: number; saldo: number };

export default function ClienteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const abrirAlEntrar = useSearchParams().get("editar") === "1";
  const toast = useToast();
  const [supabase] = useState(createClient);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const guardando = useRef(false);
  const [editando, setEditando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [nombreEditado, setNombreEditado] = useState("");
  const [telefonoEditado, setTelefonoEditado] = useState("");

  useEffect(() => {
    let activo = true;
    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const { data, error: falloCliente } = await supabase.from("clientes")
          .select("id, nombre, telefono").eq("id", id).maybeSingle();
        if (falloCliente) throw falloCliente;
        if (!activo) return;
        setCliente(data as Cliente | null);
        if (data && abrirAlEntrar) {
          setNombreEditado(data.nombre);
          setTelefonoEditado(data.telefono);
          setEditando(true);
        }
        if (!data) { setCompras([]); return; }

        const historial: Compra[] = [];
        while (activo) {
          const { data: lote, count, error: falloCompras } = await supabase.from("saldo_por_venta")
            .select("id, folio, fecha, estado, total, pagado, saldo", { count: "exact" })
            .eq("cliente_id", id).order("fecha", { ascending: false }).order("id", { ascending: false })
            .range(historial.length, historial.length + 999);
          if (falloCompras) throw falloCompras;
          if (!activo) return;
          historial.push(...((lote ?? []) as Compra[]));
          if (!lote?.length || historial.length >= (count ?? historial.length)) break;
        }
        if (activo) setCompras(historial);
      } catch (fallo) {
        if (activo) {
          const mensaje = mensajeError(fallo, "No se pudo cargar el historial. Inténtalo de nuevo.");
          setError(mensaje); toast("error", mensaje);
        }
      } finally { if (activo) setCargando(false); }
    }
    void cargar();
    return () => { activo = false; };
  }, [supabase, id, abrirAlEntrar, toast]);

  function abrirEdicion() {
    if (!cliente) return;
    setNombreEditado(cliente.nombre);
    setTelefonoEditado(cliente.telefono);
    setEditando(true);
  }

  async function guardarCliente(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!cliente || guardando.current) return;
    const nombre = nombreEditado.trim();
    const telefono = telefonoEditado.trim();
    if (!nombre || !telefono) {
      toast("error", "Completa el nombre y el teléfono del cliente.");
      return;
    }
    if (nombre === cliente.nombre && telefono === cliente.telefono) {
      setEditando(false);
      return;
    }
    guardando.current = true;
    setOcupado(true);
    try {
      const { error: fallo } = await supabase.rpc("actualizar_cliente", {
        p_cliente_id: cliente.id,
        p_nombre: nombre,
        p_telefono: telefono,
      });
      if (fallo) throw fallo;
      setCliente({ ...cliente, nombre, telefono });
      setEditando(false);
      toast("exito", "Cliente actualizado.");
    } catch (fallo) {
      toast("error", mensajeError(fallo, "No se pudo actualizar el cliente. Inténtalo de nuevo."));
    } finally {
      guardando.current = false;
      setOcupado(false);
    }
  }

  const vigentes = compras.filter((compra) => compra.estado !== "cancelado");
  const vendido = vigentes.reduce((suma, compra) => suma + Math.round(Number(compra.total) * 100), 0) / 100;
  const saldo = vigentes.reduce((suma, compra) => suma + Math.round(Number(compra.saldo) * 100), 0) / 100;

  return <div className="mx-auto max-w-5xl pb-12">
    <Link href="/clientes" className="ui-soft">← Volver a clientes</Link>
    {cargando && <p className="ui-muted mt-8 text-sm">Cargando historial…</p>}
    {!cargando && error && <p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {!cargando && !error && !cliente && <p className="ui-panel ui-muted mt-6 p-6">No se encontró este cliente.</p>}
    {!cargando && !error && cliente && <>
      <header className="mt-6"><p className="ui-eyebrow">Ficha de cliente</p><h1 className="ui-title mt-2">{cliente.nombre}</h1><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={abrirEdicion} aria-expanded={editando} aria-controls="formulario-editar-cliente" className="ui-primary w-full sm:w-auto">✎ Editar cliente</button><a href={`tel:${cliente.telefono.replace(/[^\d+]/g, "")}`} className="ui-soft w-full sm:w-auto">Llamar · {cliente.telefono}</a></div></header>
      {editando && <section id="formulario-editar-cliente" className="ui-panel mt-5 p-5 sm:p-6" aria-label="Editar cliente">
        <h2 className="ui-section-title">Editar datos del cliente</h2>
        <form onSubmit={guardarCliente} onKeyDown={avanzarConEnter} className="mt-4">
          <fieldset disabled={ocupado} className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-[#294d52]">Nombre *<input autoFocus required type="text" value={nombreEditado} onChange={(e) => setNombreEditado(e.target.value)} className="ui-input mt-2" /></label>
            <label className="block text-sm font-semibold text-[#294d52]">Teléfono *<input required type="tel" inputMode="tel" value={telefonoEditado} onChange={(e) => setTelefonoEditado(e.target.value)} className="ui-input mt-2" /></label>
          </fieldset>
          <p className="ui-muted mt-3 text-xs">Los cambios se aplican a la ficha. Los datos de ventas anteriores se conservan como fueron registrados.</p>
          <div className="mt-5 flex flex-wrap gap-3"><button type="submit" disabled={ocupado} className="ui-primary">{ocupado ? "Guardando…" : "Guardar cambios"}</button><button type="button" disabled={ocupado} onClick={() => setEditando(false)} className="ui-soft">Cancelar</button></div>
        </form>
      </section>}
      <section aria-label="Resumen del cliente" className="mt-7 grid gap-3 sm:grid-cols-3">
        <div className="ui-panel p-5"><p className="ui-muted text-sm">Compras registradas</p><p className="mt-2 text-3xl font-extrabold text-[#203338]">{compras.length}</p></div>
        <div className="ui-panel p-5"><p className="ui-muted text-sm">Total comprado</p><p className="mt-2 text-2xl font-extrabold text-[#203338]">{dinero(vendido)}</p></div>
        <div className="ui-panel border-t-4 border-t-[#f1b457] p-5"><p className="text-sm text-[#805114]">Saldo pendiente</p><p className="mt-2 text-2xl font-extrabold text-[#805114]">{dinero(saldo)}</p></div>
      </section>
      <section className="ui-panel mt-6 overflow-hidden">
        <div className="border-b border-[#e1e8e3] px-5 py-4"><h2 className="ui-section-title">Historial de compras</h2><p className="ui-muted mt-1 text-xs">De la más reciente a la más antigua</p></div>
        {compras.length === 0 ? <p className="ui-muted p-8 text-center text-sm">Este cliente aún no tiene compras.</p> : <div className="divide-y divide-[#e1e8e3]">
          {compras.map((compra) => <Link key={compra.id} href={`/ventas/${compra.id}`} className="block p-5 transition-colors hover:bg-[#f4faf6] focus-visible:outline-2 focus-visible:outline-[#17636b]">
            <div className="flex items-start justify-between gap-3"><div><p className="ui-eyebrow">{compra.folio}</p><p className="ui-muted mt-1 text-sm">{fecha(compra.fecha)}</p></div><EstadoBadge estado={compra.estado} /></div>
            <div className="mt-4 flex flex-wrap justify-between gap-x-6 gap-y-2 text-sm"><span>Total <strong className="ml-1 text-[#203338]">{dinero(compra.total)}</strong></span><span>Pagado <strong className="ml-1 text-[#203338]">{dinero(compra.pagado)}</strong></span><span>Saldo <strong className="ml-1 text-[#805114]">{dinero(compra.saldo)}</strong></span></div>
          </Link>)}
        </div>}
      </section>
    </>}
  </div>;
}
