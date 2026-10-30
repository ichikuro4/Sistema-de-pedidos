"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { mensajeError } from "@/lib/mensajes-error";

export function PorCobrarBadge() {
  const ruta = usePathname();
  const toast = useToast();
  const [supabase] = useState(createClient);
  const [cantidad, setCantidad] = useState<number | null>(null);

  useEffect(() => {
    let activo = true;
    async function cargar() {
      try {
        const { count, error } = await supabase.from("por_cobrar").select("id", { count: "exact", head: true });
        if (error) throw error;
        if (activo) setCantidad(count ?? 0);
      } catch (error) {
        if (activo) {
          setCantidad(null);
          toast("error", mensajeError(error, "No se pudo actualizar el contador por cobrar."));
        }
      }
    }
    void cargar();
    return () => { activo = false; };
  }, [supabase, ruta, toast]);

  return (
    <span
      aria-label={cantidad === null ? "Cargando ventas por cobrar" : `${cantidad} ventas por cobrar`}
      className="inline-flex min-w-6 items-center justify-center rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-900"
    >
      {cantidad ?? "…"}
    </span>
  );
}
