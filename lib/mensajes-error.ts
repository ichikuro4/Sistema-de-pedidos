const mensajesNegocio = [
  "El nombre del cliente es obligatorio",
  "El teléfono del cliente es obligatorio",
  "La venta debe tener al menos un ítem",
  "Cada ítem debe tener producto_nombre",
  "Cada ítem debe tener precio",
  "Todos los precios deben ser mayores que cero",
  "El pago inicial no puede ser negativo",
  "El pago inicial no puede ser mayor que el total de la venta",
  "El monto del pago debe ser mayor que cero",
  "El pago no puede ser mayor que el saldo pendiente",
  "Solo se pueden agregar pagos a ventas pendientes",
  "La venta no existe",
  "No tienes permiso para registrar ventas",
  "No tienes permiso para registrar pagos",
  "No tienes permiso para cancelar ventas",
];

export function mensajeError(error: unknown, alternativa: string) {
  const mensaje = error instanceof Error ? error.message :
    typeof error === "object" && error !== null && "message" in error ? String(error.message) : "";
  if (/failed to fetch|network|networkerror|timeout|timed out|fetch failed|connection|offline/i.test(mensaje)) {
    return "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.";
  }
  if (/invalid login credentials|invalid credentials/i.test(mensaje)) {
    return "Correo o contraseña incorrectos.";
  }
  if (/jwt|session|not authenticated|permission denied|row.level.security|42501|401|403/i.test(mensaje)) {
    return "Tu sesión no permite realizar esta acción. Vuelve a iniciar sesión.";
  }
  if (mensajesNegocio.some((conocido) => mensaje.startsWith(conocido))) return mensaje;
  return alternativa;
}
