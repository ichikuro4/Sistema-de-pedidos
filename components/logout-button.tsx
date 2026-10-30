"use client";

import { useState } from "react";
import { useToast } from "@/components/toast-provider";
import { createClient } from "@/lib/supabase/client";
import { mensajeError } from "@/lib/mensajes-error";

export function LogoutButton() {
  const [supabase] = useState(createClient);
  const toast = useToast();
  const [cerrando, setCerrando] = useState(false);

  async function cerrarSesion() {
    if (cerrando) return;
    setCerrando(true);
    try {
      const { error: errorSesion } = await supabase.auth.signOut();
      if (errorSesion) throw errorSesion;
      window.location.replace("/login");
    } catch (error) {
      toast("error", mensajeError(error, "No se pudo cerrar la sesión. Inténtalo de nuevo."));
      setCerrando(false);
    }
  }

  return (
    <div className="mt-4 border-t border-slate-200 pt-4 md:mt-auto">
      <button
        type="button"
        onClick={cerrarSesion}
        disabled={cerrando}
        className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950 disabled:cursor-wait disabled:opacity-60"
      >
        {cerrando ? "Cerrando sesión…" : "Cerrar sesión"}
      </button>
    </div>
  );
}
