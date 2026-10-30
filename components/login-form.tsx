"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";
import { createClient } from "@/lib/supabase/client";
import { avanzarConEnter } from "@/lib/formulario-teclado";
import { mensajeError } from "@/lib/mensajes-error";

export default function LoginForm() {
  const router = useRouter();
  const toast = useToast();
  const enviando = useRef(false);
  const [supabase] = useState(createClient);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando.current) return;
    enviando.current = true;
    setIsLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      toast("exito", "Sesión iniciada.");
      router.replace("/ventas");
      router.refresh();
    } catch (error) {
      toast("error", mensajeError(error, "No se pudo iniciar sesión. Inténtalo de nuevo."));
      enviando.current = false;
      setIsLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} onKeyDown={avanzarConEnter}>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700">
          Correo electrónico
        </span>
        <input
          required
          autoFocus
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none ring-indigo-500 focus:ring-2"
          placeholder="tu@correo.com"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700">
          Contraseña
        </span>
        <input
          required
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none ring-indigo-500 focus:ring-2"
        />
      </label>
      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
