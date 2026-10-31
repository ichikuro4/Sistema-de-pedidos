"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type TipoToast = "exito" | "error";
type Toast = { id: number; tipo: TipoToast; mensaje: string };
type MostrarToast = (tipo: TipoToast, mensaje: string) => void;

const ToastContext = createContext<MostrarToast | null>(null);
let siguienteId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Toast[]>([]);

  const mostrar = useCallback<MostrarToast>((tipo, mensaje) => {
    const id = ++siguienteId;
    setAvisos((actuales) => [...actuales, { id, tipo, mensaje }]);
    window.setTimeout(() => setAvisos((actuales) => actuales.filter((aviso) => aviso.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={mostrar}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-[calc(5.6rem+env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 md:bottom-6" aria-live="polite">
        {avisos.map((aviso) => (
          <div
            key={aviso.id}
            role={aviso.tipo === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex w-full max-w-md items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl ${aviso.tipo === "error" ? "border-rose-200 bg-[#fff2ef] text-rose-900" : "border-[#bce5cd] bg-[#ecf8f0] text-[#246547]"}`}
          >
            <span>{aviso.mensaje}</span>
            <button type="button" onClick={() => setAvisos((actuales) => actuales.filter((actual) => actual.id !== aviso.id))} aria-label="Cerrar aviso" className="grid min-h-8 min-w-8 place-items-center rounded-lg text-lg leading-none opacity-70 hover:bg-black/5 hover:opacity-100">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const mostrar = useContext(ToastContext);
  if (!mostrar) throw new Error("ToastProvider no está disponible.");
  return mostrar;
}
