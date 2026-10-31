"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { dinero, fecha } from "@/components/venta-presentacion";
import { mensajeError } from "@/lib/mensajes-error";

type VentaPorCobrar = {
  id: string;
  folio: string;
  fecha: string;
  cliente_nombre: string;
  cliente_telefono: string;
  total: number;
  saldo: number;
};

const milisegundosPorDia = 24 * 60 * 60 * 1000;

export default function PorCobrarPage() {
  const router = useRouter();
  const toast = useToast();
  const [supabase] = useState(createClient);
  const [ventas, setVentas] = useState<VentaPorCobrar[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    let activo = true;
    async function cargar() {
      const resultados: VentaPorCobrar[] = [];
      try {
        while (activo) {
          const { data, count, error: consultaError } = await supabase
            .from("por_cobrar")
            .select("id, folio, fecha, cliente_nombre, cliente_telefono, total, saldo", { count: "exact" })
            .order("fecha", { ascending: true })
            .order("id", { ascending: true })
            .range(resultados.length, resultados.length + 999);
          if (consultaError) throw consultaError;
          if (!activo) return;
          const lote = (data ?? []) as VentaPorCobrar[];
          resultados.push(...lote);
          if (lote.length === 0 || resultados.length >= (count ?? resultados.length)) break;
        }
        if (activo) setVentas(resultados);
      } catch (fallo) {
        if (activo) {
          const mensaje = mensajeError(fallo, "No se pudieron cargar las ventas pendientes. Inténtalo de nuevo.");
          setError(mensaje);
          toast("error", mensaje);
        }
      } finally {
        if (activo) setCargando(false);
      }
    }
    void cargar();
    return () => { activo = false; };
  }, [supabase, toast]);

  useEffect(() => {
    const intervalo = window.setInterval(() => setAhora(Date.now()), 60_000);
    return () => window.clearInterval(intervalo);
  }, []);

  const totalPorCobrar = ventas.reduce((suma, venta) => suma + Math.round(Number(venta.saldo) * 100), 0) / 100;

  return (
    <div className="mx-auto max-w-7xl pb-12">
      <header>
        <p className="ui-eyebrow">Seguimiento de pedidos</p>
        <h1 className="ui-title mt-2">Por cobrar</h1>
        <p className="ui-muted mt-2 text-sm">Prioriza las ventas más antiguas y llama al cliente en un toque.</p>
        {!cargando && !error && (
          <p className="mt-5 rounded-[1.4rem] bg-[#214c50] px-5 py-5 text-sm font-medium text-[#d7e9e2] shadow-lg shadow-[#183e3d]/10">
            <span className="block text-xs font-bold uppercase tracking-[.15em] text-[#b4d8d1]">Saldo por cobrar</span>
            <strong className="mt-1 block text-3xl text-white">{dinero(totalPorCobrar)}</strong>
            <span className="mt-2 block">{ventas.length} {ventas.length === 1 ? "venta pendiente" : "ventas pendientes"}</span>
          </p>
        )}
      </header>

      <section className="ui-panel mt-6 overflow-hidden">
        {cargando ? (
          <p className="px-5 py-10 text-sm text-slate-600">Cargando ventas pendientes…</p>
        ) : error ? (
          <p role="alert" className="px-5 py-10 text-sm text-rose-700">{error}</p>
        ) : ventas.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-600">No hay ventas pendientes</p>
        ) : (
          <>
          <div className="divide-y divide-[#e1e8e3] md:hidden">
            {ventas.map((venta) => {
              const dias = Math.max(0, Math.floor((ahora - new Date(venta.fecha).getTime()) / milisegundosPorDia));
              const vieja = dias > 7 && Number(venta.saldo) > 0;
              return <div key={venta.id} className={`p-4 ${vieja ? "bg-[#fff8e9]" : ""}`}>
                <button type="button" onClick={() => router.push(`/ventas/${venta.id}`)} className="w-full rounded-xl text-left hover:bg-[#f4faf6] focus-visible:outline-2 focus-visible:outline-[#17636b]">
                  <span className="flex items-center justify-between gap-2"><span className="ui-eyebrow">{venta.folio}</span>{vieja && <span className="rounded-full bg-[#f8dfaa] px-2 py-1 text-xs font-bold text-[#805114]">Más de 7 días</span>}</span>
                  <span className="mt-2 block text-lg font-bold text-[#203338]">{venta.cliente_nombre}</span>
                  <span className="ui-muted mt-1 block text-xs">{fecha(venta.fecha)} · Hace {dias} {dias === 1 ? "día" : "días"}</span>
                  <span className="mt-4 flex items-end justify-between"><span className="ui-muted text-xs">Total {dinero(venta.total)}</span><span className="text-right"><span className="block text-xs text-[#94621d]">Saldo pendiente</span><strong className="text-lg text-[#805114]">{dinero(venta.saldo)}</strong></span></span>
                  <span className="mt-3 block text-right text-xs font-bold text-[#17636b]">Ver venta →</span>
                </button>
                <a href={`tel:${venta.cliente_telefono.replace(/[^\d+]/g, "")}`} className="ui-soft mt-3 w-full">Llamar · {venta.cliente_telefono}</a>
              </div>;
            })}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="ui-table min-w-[900px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Folio", "Fecha", "Cliente", "Teléfono", "Total", "Saldo", "Días desde la venta"].map((columna) => (
                    <th key={columna} scope="col" className="px-4 py-3 font-semibold">{columna}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ventas.map((venta) => {
                  const dias = Math.max(0, Math.floor((ahora - new Date(venta.fecha).getTime()) / milisegundosPorDia));
                  const vieja = dias > 7 && Number(venta.saldo) > 0;
                  return (
                    <tr
                      key={venta.id}
                      role="link"
                      tabIndex={0}
                      aria-label={`Ver venta ${venta.folio}`}
                      onClick={() => router.push(`/ventas/${venta.id}`)}
                      onKeyDown={(evento) => {
                        if (evento.target !== evento.currentTarget) return;
                        if (evento.key === "Enter" || evento.key === " ") {
                          evento.preventDefault();
                          router.push(`/ventas/${venta.id}`);
                        }
                      }}
                      className={`cursor-pointer focus:outline-2 focus:outline-slate-600 ${vieja ? "bg-amber-50/70 hover:bg-amber-100/70" : "hover:bg-slate-50"}`}
                    >
                      <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-950">{venta.folio}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-600">{fecha(venta.fecha)}</td>
                      <td className="px-4 py-4 text-slate-900">{venta.cliente_nombre}</td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <a
                          href={`tel:${venta.cliente_telefono.replace(/[^\d+]/g, "")}`}
                          onClick={(evento) => evento.stopPropagation()}
                          className="font-medium text-slate-900 underline decoration-slate-400 underline-offset-2 hover:text-indigo-700"
                        >
                          {venta.cliente_telefono}
                        </a>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-900">{dinero(venta.total)}</td>
                      <td className="whitespace-nowrap px-4 py-4 font-semibold text-amber-900">{dinero(venta.saldo)}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-700">
                        {dias} {dias === 1 ? "día" : "días"}
                        {vieja && <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">Viejo</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
    </div>
  );
}
