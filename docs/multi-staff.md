# Multi-staff — diferido (asunción de recurso único)

El schema ya tiene `Staff`, `Availability.staffId` y `Booking.staffId`, pero el MVP
asume **un solo recurso por negocio** (el dueño). Esto está documentado acá para no
chocar el acantilado de escalado sin avisar.

## Dónde se asume "recurso único" hoy

1. **Índice de doble reserva** — `Booking_active_slot_unique` (migración
   `20260615130000`) es `UNIQUE (businessId, date, startTime) WHERE status IN
   (PENDING, CONFIRMED)`. **Ignora `staffId`**: dos empleados no podrían tener el
   mismo horario. Correcto con 1 recurso; incorrecto con varios.

2. **Generación de slots** — [app/api/[slug]/slots/route.ts](../app/api/[slug]/slots/route.ts)
   busca `availability` con `staffId: null` y resta las reservas del negocio sin
   discriminar empleado.

3. **Conflicto en POST** — [app/api/[slug]/bookings/route.ts](../app/api/[slug]/bookings/route.ts)
   chequea solapamiento por negocio+fecha, no por empleado.

4. **Disponibilidad** — el dashboard solo edita filas con `staffId: null`.

## Qué cambiar cuando se habilite multi-staff

- **Índice**: reemplazar por uno que incluya el recurso. Como `staffId` es nullable
  y Postgres trata NULL como distinto, usar una expresión:
  `CREATE UNIQUE INDEX ... ON "Booking" ("businessId", COALESCE("staffId",'_'), "date", "startTime") WHERE status IN ('PENDING','CONFIRMED')`.
  Para impedir solapamientos de **distinta duración** a nivel DB (no solo mismo
  inicio), evaluar una *exclusion constraint* con `btree_gist` sobre un rango
  `tsrange` por (businessId, staffId).
- **Slots**: el cliente debe elegir empleado (o "cualquiera"); generar slots por
  empleado y unir.
- **POST**: el solapamiento se chequea por `staffId`; asignar empleado (o el primero
  libre si "cualquiera").
- **Disponibilidad**: UI por empleado además de la del negocio.

## Estado

Diferido a v2. No construir hasta que haya demanda real de varios profesionales
por negocio. El MVP funciona y es correcto para 1 recurso.
