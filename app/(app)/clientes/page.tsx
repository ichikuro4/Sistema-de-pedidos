"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { mensajeError } from "@/lib/mensajes-error";

type Cliente = { id: string; nombre: string; telefono: string };
const porPagina = 20;

export default function ClientesPage() {
  const toast = useToast();
  const [supabase] = useState(createClient);
  const [busqueda, setBusqueda] = useState("");
  const [termino, setTermino] = useState("");
  const [pagina, setPagina] = useState(0);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const temporizador = window.setTimeout(() => setTermino(busqueda.trim()), 300);
    return () => window.clearTimeout(temporizador);
  }, [busqueda]);

  useEffect(() => {
    let activo = true;
    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        let consulta = supabase.from("clientes")
          .select("id, nombre, telefono", { count: "exact" })
          .order("nombre", { ascending: true }).order("id", { ascending: true });
        if (termino) {
          const seguro = termino.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
          consulta = consulta.or(`nombre.ilike."%${seguro}%",telefono.ilike."%${seguro}%"`);
        }
        const { data, count, error: fallo } = await consulta.range(pagina * porPagina, (pagina + 1) * porPagina - 1);
        if (fallo) throw fallo;
        if (activo) { setClientes((data ?? []) as Cliente[]); setTotal(count ?? 0); }
      } catch (fallo) {
        if (activo) {
          const mensaje = mensajeError(fallo, "No se pudieron cargar los clientes. Inténtalo de nuevo.");
          setError(mensaje); setClientes([]); setTotal(0); toast("error", mensaje);
        }
      } finally { if (activo) setCargando(false); }
    }
    void cargar();
    return () => { activo = false; };
  }, [supabase, termino, pagina, toast]);

  const paginas = Math.max(1, Math.ceil(total / porPagina));
  return <div className="mx-auto max-w-5xl pb-12">
    <header><p className="ui-eyebrow">Personas que vuelven</p><h1 className="ui-title mt-2">Clientes</h1><p className="ui-muted mt-2 text-sm">Busca por nombre o teléfono para ver su historial de compras.</p></header>
    <section className="ui-panel mt-7 p-4 sm:p-5" aria-label="Buscar clientes">
      <label className="block text-sm font-semibold text-[#294d52]">Nombre o teléfono
        <input autoFocus type="search" value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPagina(0); }} placeholder="Buscar cliente" className="ui-input mt-2" />
      </label>
    </section>
    <section className="ui-panel mt-5 overflow-hidden">
      <div className="ui-muted border-b border-[#e1e8e3] px-5 py-4 text-sm">{cargando ? "Cargando clientes…" : `${total} ${total === 1 ? "cliente" : "clientes"}`}</div>
      {error ? <p role="alert" className="p-5 text-sm text-rose-700">{error}</p> : !cargando && clientes.length === 0 ? <p className="ui-muted p-8 text-center text-sm">No se encontraron clientes.</p> :
        <div className="divide-y divide-[#e1e8e3]">{clientes.map((cliente) =>
          <Link key={cliente.id} href={`/clientes/${cliente.id}`} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[#f4faf6] focus-visible:outline-2 focus-visible:outline-[#17636b]">
            <span><strong className="block text-[#203338]">{cliente.nombre}</strong><span className="ui-muted mt-1 block text-sm">{cliente.telefono}</span></span><span aria-hidden="true" className="text-lg text-[#17636b]">›</span>
          </Link>)}</div>}
      {!error && total > porPagina && <nav aria-label="Paginación de clientes" className="flex items-center justify-between gap-3 border-t border-[#e1e8e3] p-4 text-sm">
        <button type="button" className="ui-soft" disabled={pagina === 0 || cargando} onClick={() => setPagina((actual) => actual - 1)}>Anterior</button>
        <span className="ui-muted">{pagina + 1} de {paginas}</span>
        <button type="button" className="ui-soft" disabled={pagina + 1 >= paginas || cargando} onClick={() => setPagina((actual) => actual + 1)}>Siguiente</button>
      </nav>}
    </section>
  </div>;
}
