"use client";

import { useState } from "react";
import { useToast } from "@/components/toast-provider";
import { createClient } from "@/lib/supabase/client";
import { mensajeError } from "@/lib/mensajes-error";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
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
    <div className={compact ? "shrink-0" : "border-t border-[#e1e8e3] pt-3"}>
      <button
        type="button"
        onClick={cerrarSesion}
        disabled={cerrando}
        className={compact ? "ui-soft min-h-10 px-3 text-xs" : "w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#627572] hover:bg-[#f2f5ef] hover:text-[#23484c] disabled:cursor-wait disabled:opacity-60"}
      >
        {cerrando ? "Saliendo…" : compact ? "Salir" : "Cerrar sesión"}
      </button>
    </div>
  );
}
