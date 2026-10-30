import type { KeyboardEvent } from "react";

export function avanzarConEnter(evento: KeyboardEvent<HTMLFormElement>) {
  if (evento.key !== "Enter" || evento.shiftKey || evento.nativeEvent.isComposing) return;
  const origen = evento.target;
  if (!(origen instanceof HTMLInputElement || origen instanceof HTMLSelectElement || origen instanceof HTMLTextAreaElement)) return;
  if (origen instanceof HTMLInputElement && ["radio", "checkbox", "submit"].includes(origen.type)) return;
  const controles = Array.from(evento.currentTarget.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea"))
    .filter((control) => !control.disabled && !("readOnly" in control && control.readOnly) && !(control instanceof HTMLInputElement && ["radio", "hidden", "submit"].includes(control.type)));
  const siguiente = controles[controles.indexOf(origen) + 1];
  evento.preventDefault();
  if (siguiente) siguiente.focus();
  else evento.currentTarget.requestSubmit();
}
