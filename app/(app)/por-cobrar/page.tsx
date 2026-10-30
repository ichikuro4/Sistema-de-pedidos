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
        <p className="text-sm font-medium text-slate-500">Cobros pendientes</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Por cobrar</h1>
        {!cargando && !error && (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            {ventas.length} ventas pendientes · {dinero(totalPorCobrar)} por cobrar
          </p>
        )}
      </header>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {cargando ? (
          <p className="px-5 py-10 text-sm text-slate-600">Cargando ventas pendientes…</p>
        ) : error ? (
          <p role="alert" className="px-5 py-10 text-sm text-rose-700">{error}</p>
        ) : ventas.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-600">No hay ventas pendientes</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-left text-sm">
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
        )}
      </section>
    </div>
  );
}
