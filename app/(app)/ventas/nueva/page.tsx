"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";
import { createClient } from "@/lib/supabase/client";
import { avanzarConEnter } from "@/lib/formulario-teclado";
import { mensajeError } from "@/lib/mensajes-error";

type TipoPago = "completo" | "parcial";
type Producto = { key: number; nombre: string; descripcion: string; precio: string; precioManual: boolean };
type Sugerencia = { nombre: string; precio: number };
type VentaLista = {
  clienteNombre: string;
  clienteTelefono: string;
  tipoPago: TipoPago;
  pagoInicial: number;
  items: { producto_nombre: string; descripcion: string; precio: number }[];
};

const dinero = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const campo = "ui-input mt-1.5 text-base";

function centimos(valor: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(valor)) return null;
  const resultado = Math.round(Number(valor) * 100);
  return Number.isSafeInteger(resultado) ? resultado : null;
}

export default function NuevaVentaPage() {
  const router = useRouter();
  const toast = useToast();
  const [supabase] = useState(createClient);
  const siguienteKey = useRef(2);
  const ocupada = useRef(false);
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [tipoPago, setTipoPago] = useState<TipoPago>("completo");
  const [productos, setProductos] = useState<Producto[]>([{ key: 1, nombre: "", descripcion: "", precio: "", precioManual: false }]);
  const [abono, setAbono] = useState("");
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [cargandoSugerencias, setCargandoSugerencias] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [guardada, setGuardada] = useState(false);
  const [duplicados, setDuplicados] = useState<string[]>([]);
  const [ventaPendiente, setVentaPendiente] = useState<VentaLista | null>(null);

  useEffect(() => {
    let activo = true;
    // Una consulta al montar; se conserva el precio de la venta más reciente por nombre.
    async function cargarSugerencias() {
      try {
        const { data, error } = await supabase.from("venta_items")
          .select("producto_nombre, precio, ventas!inner(fecha)")
          .order("ventas(fecha)", { ascending: false });
        if (error) throw error;
        if (!activo) return;
        const filas = (data ?? []) as unknown as { producto_nombre: string; precio: number; ventas: { fecha: string } | { fecha: string }[] }[];
        const fechaVenta = (fila: typeof filas[number]) => Array.isArray(fila.ventas) ? fila.ventas[0]?.fecha : fila.ventas.fecha;
        filas.sort((a, b) => Date.parse(fechaVenta(b) ?? "") - Date.parse(fechaVenta(a) ?? ""));
        const unicas = new Map<string, Sugerencia>();
        for (const fila of filas) {
          const clave = fila.producto_nombre.trim().toLocaleLowerCase("es");
          if (clave && !unicas.has(clave)) unicas.set(clave, { nombre: fila.producto_nombre, precio: Number(fila.precio) });
        }
        setSugerencias([...unicas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
      } catch (error) {
        if (activo) toast("error", mensajeError(error, "No se pudieron cargar las sugerencias. Puedes escribir un nombre nuevo."));
      } finally {
        if (activo) setCargandoSugerencias(false);
      }
    }
    void cargarSugerencias();
    return () => { activo = false; };
  }, [supabase, toast]);

  const totalCentimos = productos.reduce((suma, producto) => suma + (centimos(producto.precio) ?? 0), 0);
  const abonoCentimos = tipoPago === "completo" ? totalCentimos : (centimos(abono) ?? 0);

  function cambiarProducto(key: number, campoProducto: "nombre" | "descripcion" | "precio", valor: string) {
    setProductos((actuales) => actuales.map((producto) => {
      if (producto.key !== key) return producto;
      if (campoProducto === "precio") return { ...producto, precio: valor, precioManual: true };
      if (campoProducto === "nombre") {
        const sugerencia = sugerencias.find((item) => item.nombre.toLocaleLowerCase("es") === valor.trim().toLocaleLowerCase("es"));
        return { ...producto, nombre: valor, precio: producto.precioManual ? producto.precio : (sugerencia ? sugerencia.precio.toFixed(2) : "") };
      }
      return { ...producto, descripcion: valor };
    }));
  }

  function validar(): VentaLista | null {
    if (!clienteNombre.trim() || !clienteTelefono.trim()) {
      toast("error", "Completa el nombre y el teléfono del cliente.");
      return null;
    }
    const items: VentaLista["items"] = [];
    for (const [indice, producto] of productos.entries()) {
      const precioCentimos = centimos(producto.precio);
      if (!producto.nombre.trim() || !producto.descripcion.trim() || precioCentimos === null || precioCentimos <= 0) {
        toast("error", `Completa nombre, descripción y precio mayor que cero en el producto ${indice + 1}. Usa hasta dos decimales.`);
        return null;
      }
      items.push({ producto_nombre: producto.nombre.trim(), descripcion: producto.descripcion.trim(), precio: precioCentimos / 100 });
    }
    const total = items.reduce((suma, item) => suma + Math.round(item.precio * 100), 0);
    if (!items.length || !Number.isSafeInteger(total) || total > 9999999999) {
      toast("error", "El total de la venta excede el límite permitido.");
      return null;
    }
    const inicial = tipoPago === "completo" ? total : centimos(abono || "0");
    if (inicial === null || inicial < 0 || inicial > total) {
      toast("error", "El abono debe estar entre cero y el total, con hasta dos decimales.");
      return null;
    }
    return { clienteNombre: clienteNombre.trim(), clienteTelefono: clienteTelefono.trim(), tipoPago, pagoInicial: inicial / 100, items };
  }

  async function guardar(venta: VentaLista) {
    if (ocupada.current) return;
    ocupada.current = true;
    setOcupado(true);
    setVentaPendiente(null);
    setDuplicados([]);
    try {
      const { data: id, error } = await supabase.rpc("crear_venta", {
        p_cliente_nombre: venta.clienteNombre,
        p_cliente_telefono: venta.clienteTelefono,
        p_tipo_pago: venta.tipoPago,
        p_items: venta.items,
        p_pago_inicial: venta.pagoInicial,
        p_metodo_pago: "efectivo",
        p_notas: null,
      });
      if (error) throw error;
      setGuardada(true);
      if (!id || typeof id !== "string") {
        toast("exito", "Venta registrada. Revisa el listado para ver su folio.");
        router.push("/ventas");
        return;
      }
      let folio: string | undefined;
      try {
        const { data: registro } = await supabase.from("ventas").select("folio").eq("id", id).single();
        folio = registro?.folio;
      } catch {
        // La venta ya quedó registrada; un fallo al consultar el folio no la revierte.
      }
      toast("exito", folio ? `Venta guardada · Folio ${folio}` : "Venta guardada correctamente.");
      setClienteNombre("");
      setClienteTelefono("");
      setTipoPago("completo");
      setProductos([{ key: siguienteKey.current++, nombre: "", descripcion: "", precio: "", precioManual: false }]);
      setAbono("");
      router.push(`/ventas/${encodeURIComponent(id)}`);
    } catch (error) {
      toast("error", mensajeError(error, "No se pudo guardar la venta. Inténtalo de nuevo."));
    } finally {
      ocupada.current = false;
      setOcupado(false);
    }
  }

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupada.current || ventaPendiente || guardada) return;
    const venta = validar();
    if (!venta) return;
    ocupada.current = true;
    setOcupado(true);
    try {
      const nombres = [...new Set(venta.items.map((item) => item.producto_nombre))];
      const encontrados = (await Promise.all(nombres.map(async (nombre) => {
        const { data, error } = await supabase.from("venta_items")
          .select("producto_nombre, ventas!inner(estado)")
          .eq("producto_nombre", nombre)
          .in("ventas.estado", ["pendiente", "pagado"])
          .limit(1);
        if (error) throw error;
        return data?.length ? nombre : null;
      }))).filter((nombre): nombre is string => nombre !== null);
      if (encontrados.length) {
        setDuplicados(encontrados);
        setVentaPendiente(venta);
      } else {
        ocupada.current = false;
        await guardar(venta);
      }
    } catch (error) {
      toast("error", mensajeError(error, "No se pudieron comprobar las figuras existentes. Inténtalo de nuevo."));
    } finally {
      ocupada.current = false;
      setOcupado(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl pb-12">
      <header className="mb-7">
        <p className="ui-eyebrow">El cuchitril de WALL y Eva</p>
        <h1 className="ui-title mt-2">Nueva venta</h1>
        <p className="ui-muted mt-2 text-sm">Registra el cliente, las figuras y el pago inicial.</p>
      </header>
      <form onSubmit={alEnviar} onKeyDown={avanzarConEnter} noValidate className="space-y-5">
        <fieldset disabled={ocupado || Boolean(ventaPendiente) || guardada} className="space-y-5 disabled:opacity-75">
          <section className="ui-panel p-4 sm:p-6">
            <h2 className="ui-section-title"><span className="mr-2 text-[#d1882d]">01</span> Cliente</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">Nombre *
                <input autoFocus className={campo} type="text" autoComplete="name" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} required placeholder="Nombre del cliente" />
              </label>
              <label className="block text-sm font-medium text-slate-700">Teléfono *
                <input className={campo} type="tel" inputMode="tel" autoComplete="tel" value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} required placeholder="Número de contacto" />
              </label>
            </div>
          </section>
          <section className="ui-panel p-4 sm:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="ui-section-title"><span className="mr-2 text-[#d1882d]">02</span> Figuras</h2>
              <span className="text-xs text-slate-500">{productos.length} {productos.length === 1 ? "figura" : "figuras"}</span>
            </div>
            <datalist id="figuras-vendidas">{sugerencias.map((item) => <option key={item.nombre} value={item.nombre} label={`Último precio: ${dinero.format(item.precio)}`} />)}</datalist>
            <div className="mt-4 space-y-4">
              {productos.map((producto, indice) => (
                <div key={producto.key} className="rounded-2xl border border-[#dce7df] bg-[#f7faf6] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-800">Figura {indice + 1}</h3>
                    <button type="button" onClick={() => setProductos((actuales) => actuales.filter((item) => item.key !== producto.key))} disabled={productos.length === 1} className="rounded-lg px-2 py-1 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-400">Quitar</button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Nombre figura *
                        <input className={campo} list="figuras-vendidas" value={producto.nombre} onChange={(e) => cambiarProducto(producto.key, "nombre", e.target.value)} required placeholder="Ej. WALL-E" aria-describedby="ayuda-figuras" />
                      </label>
                      {sugerencias.filter((item) => item.nombre.toLocaleLowerCase("es") === producto.nombre.trim().toLocaleLowerCase("es")).map((item) => (
                        <button key={item.nombre} type="button" onClick={() => setProductos((actuales) => actuales.map((actual) => actual.key === producto.key ? { ...actual, precio: item.precio.toFixed(2), precioManual: false } : actual))} className="mt-1 rounded-lg py-1 text-left text-xs font-semibold text-[#17636b] underline underline-offset-2">Usar último precio: {dinero.format(item.precio)}</button>
                      ))}
                    </div>
                    <label className="block text-sm font-medium text-slate-700">Precio (S/) *
                      <input className={campo} type="number" inputMode="decimal" min="0.01" step="0.01" value={producto.precio} onChange={(e) => cambiarProducto(producto.key, "precio", e.target.value)} required placeholder="0.00" />
                    </label>
                    <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Descripción *
                      <input className={campo} type="text" value={producto.descripcion} onChange={(e) => cambiarProducto(producto.key, "descripcion", e.target.value)} required placeholder="Detalles de la figura" />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <p id="ayuda-figuras" className="mt-3 text-xs text-slate-500">{cargandoSugerencias ? "Cargando nombres anteriores…" : "Puedes elegir un nombre anterior o escribir uno nuevo. El precio sugerido se puede cambiar."}</p>
            <button type="button" onClick={() => setProductos((actuales) => [...actuales, { key: siguienteKey.current++, nombre: "", descripcion: "", precio: "", precioManual: false }])} className="mt-4 w-full rounded-xl border-2 border-dashed border-[#9cc8bd] px-4 py-3 text-sm font-bold text-[#17636b] hover:bg-[#edf7f0]">+ Agregar otra figura</button>
          </section>
          <section className="ui-panel p-4 sm:p-6">
            <h2 className="ui-section-title"><span className="mr-2 text-[#d1882d]">03</span> Pago</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {(["completo", "parcial"] as const).map((tipo) => (
                <label key={tipo} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-semibold capitalize ${tipoPago === tipo ? "border-[#17636b] bg-[#e9f3ef] text-[#124d55]" : "border-[#dce7df] text-[#62767a]"}`}>
                  <input type="radio" name="tipo_pago" value={tipo} checked={tipoPago === tipo} onChange={() => setTipoPago(tipo)} className="accent-[#17636b]" />{tipo}
                </label>
              ))}
            </div>
            <div className="mt-5 border-t border-[#e1e8e3] pt-4">
              <div className="flex items-center justify-between gap-3 text-lg font-bold text-[#203338]"><span>Total</span><output>{dinero.format(totalCentimos / 100)}</output></div>
              {tipoPago === "completo" ? (
                <label className="mt-4 block text-sm font-medium text-slate-700">Monto inicial
                  <input className={campo} value={dinero.format(totalCentimos / 100)} readOnly aria-readonly="true" />
                </label>
              ) : (
                <>
                  <label className="mt-4 block text-sm font-medium text-slate-700">Monto que abona ahora
                    <input className={campo} type="number" inputMode="decimal" min="0" step="0.01" value={abono} onChange={(e) => setAbono(e.target.value)} placeholder="0.00" />
                  </label>
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#fff4dd] p-3 text-sm font-bold text-[#805114]"><span>Saldo pendiente</span><output>{dinero.format(Math.max(0, totalCentimos - abonoCentimos) / 100)}</output></div>
                </>
              )}
            </div>
          </section>
        </fieldset>
        <button type="submit" disabled={ocupado || Boolean(ventaPendiente) || guardada} className="ui-primary w-full py-4 text-base">{ocupado || guardada ? "Guardando…" : "Guardar venta"}</button>
      </form>
      {ventaPendiente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-duplicados" className="ui-panel w-full max-w-md p-5 shadow-2xl sm:p-6">
            <h2 id="titulo-duplicados" className="text-xl font-bold text-slate-950">Figuras en ventas activas</h2>
            <p className="mt-3 text-sm text-slate-700">Estas figuras ya están en ventas activas: {duplicados.join(", ")}. ¿Continuar?</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" autoFocus onClick={() => { setVentaPendiente(null); setDuplicados([]); }} className="ui-soft">Cancelar</button>
              <button type="button" disabled={ocupado} onClick={() => guardar(ventaPendiente)} className="ui-primary">{ocupado ? "Guardando…" : "Continuar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
