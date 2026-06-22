// Helpers de presentación para reservas multi-servicio. Puros.
// Evitan repetir el "unir nombres / sumar precios" en cada read-site.

/** Nombres de los servicios de una reserva, unidos para mostrar: "Corte + Barba". */
export function serviceNames(services: { name: string }[]): string {
  return services.map((s) => s.name).join(" + ");
}

/**
 * Precio total para MOSTRAR al cliente: suma de los precios, o null si algún servicio
 * es "a consultar" (price null) — en ese caso el total también es "a consultar".
 * (Para ingresos/estadísticas se suma tratando null como 0; ver stats.)
 */
export function servicesTotalPrice(services: { price: number | null }[]): number | null {
  if (services.length === 0) return null;
  return services.every((s) => s.price != null)
    ? services.reduce((acc, s) => acc + (s.price ?? 0), 0)
    : null;
}
