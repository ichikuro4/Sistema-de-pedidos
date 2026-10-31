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
        <span className="mb-2 block text-sm font-semibold text-[#315458]">
          Correo electrónico
        </span>
        <input
          required
          autoFocus
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="ui-input"
          placeholder="tu@correo.com"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[#315458]">
          Contraseña
        </span>
        <input
          required
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="ui-input"
        />
      </label>
      <button
        type="submit"
        disabled={isLoading}
        className="ui-primary mt-2 w-full py-3.5"
      >
        {isLoading ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
