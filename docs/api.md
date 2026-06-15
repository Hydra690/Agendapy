# Agendapy — Documentación de API

Base URL: `http://localhost:3000` (dev) / `https://tu-dominio.com` (prod)

Todos los errores devuelven JSON con la clave `error` en español.

---

## 1. Info pública del negocio

**`GET /api/:slug`**

Devuelve la información pública del negocio, sus servicios activos y su disponibilidad horaria semanal.

### Parámetros de ruta

| Parámetro | Tipo   | Descripción               |
|-----------|--------|---------------------------|
| `slug`    | string | Identificador del negocio |

### Respuesta exitosa `200`

```json
{
  "name": "Barbería Demo",
  "slug": "barberia-demo",
  "category": "BARBERSHOP",
  "description": null,
  "whatsapp": "595981000000",
  "logoUrl": null,
  "services": [
    {
      "id": "cmqb67t8w0002i4uqvjet4wb9",
      "name": "Corte de cabello",
      "description": null,
      "duration": 30,
      "price": 50000
    }
  ],
  "availability": [
    { "dayOfWeek": "MONDAY",    "startTime": "08:00", "endTime": "18:00" },
    { "dayOfWeek": "TUESDAY",   "startTime": "08:00", "endTime": "18:00" },
    { "dayOfWeek": "SATURDAY",  "startTime": "08:00", "endTime": "18:00" }
  ]
}
```

### Errores

| Código | Condición                                    |
|--------|----------------------------------------------|
| `404`  | Negocio no encontrado o `isActive: false`    |
| `500`  | Error interno                                |

---

## 2. Slots disponibles

**`GET /api/:slug/slots`**

Devuelve los horarios disponibles para un servicio en una fecha determinada.

### Parámetros de ruta

| Parámetro | Tipo   | Descripción               |
|-----------|--------|---------------------------|
| `slug`    | string | Identificador del negocio |

### Query params

| Parámetro   | Tipo   | Requerido | Descripción                        |
|-------------|--------|-----------|------------------------------------|
| `date`      | string | Sí        | Fecha en formato `YYYY-MM-DD`      |
| `serviceId` | string | Sí        | ID del servicio                    |

### Respuesta exitosa `200` — día disponible

```json
{
  "available": true,
  "date": "2026-06-15",
  "business": {
    "id": "cmqb67sjm0001i4uqgtktjplm",
    "name": "Barbería Demo",
    "slug": "barberia-demo"
  },
  "service": {
    "id": "cmqb67t8w0002i4uqvjet4wb9",
    "name": "Corte de cabello",
    "duration": 30,
    "price": 50000
  },
  "slots": ["08:00", "08:30", "09:00", "09:30", "10:30", "11:00"]
}
```

### Respuesta `200` — día no disponible (bloqueado o sin horario)

```json
{
  "available": false,
  "reason": "El negocio no atiende ese día",
  "slots": []
}
```

### Errores

| Código | Condición                                 |
|--------|-------------------------------------------|
| `400`  | Falta `date` o `serviceId`, fecha inválida |
| `404`  | Negocio o servicio no encontrado          |
| `500`  | Error interno                             |

---

## 3. Crear reserva

**`POST /api/:slug/bookings`**

Crea una nueva reserva. Valida disponibilidad dentro de una transacción para evitar condiciones de carrera.

### Parámetros de ruta

| Parámetro | Tipo   | Descripción               |
|-----------|--------|---------------------------|
| `slug`    | string | Identificador del negocio |

### Body `application/json`

```json
{
  "serviceId":      "cmqb67t8w0002i4uqvjet4wb9",
  "date":           "2026-06-15",
  "startTime":      "11:00",
  "clientName":     "Juan Pérez",
  "clientWhatsapp": "595981123456",
  "notes":          "Primera vez"
}
```

| Campo            | Tipo   | Requerido | Descripción                                      |
|------------------|--------|-----------|--------------------------------------------------|
| `serviceId`      | string | Sí        | ID del servicio                                  |
| `date`           | string | Sí        | Fecha en formato `YYYY-MM-DD`                    |
| `startTime`      | string | Sí        | Horario de inicio en formato `HH:mm`             |
| `clientName`     | string | Sí        | Nombre del cliente                               |
| `clientWhatsapp` | string | Sí        | Número de WhatsApp (solo dígitos, 7-15 chars)    |
| `notes`          | string | No        | Notas adicionales del cliente                    |

### Respuesta exitosa `201`

```json
{
  "booking": {
    "id":        "cmqb6bldj0001kwuqpscjtper",
    "date":      "2026-06-15T00:00:00.000Z",
    "startTime": "11:00",
    "endTime":   "11:30",
    "status":    "PENDING",
    "notes":     "Primera vez",
    "service": {
      "id":       "cmqb67t8w0002i4uqvjet4wb9",
      "name":     "Corte de cabello",
      "duration": 30,
      "price":    50000
    },
    "client": {
      "id":       "cmqb6bl710000kwuqv1wi6732",
      "name":     "Juan Pérez",
      "whatsapp": "595981123456"
    }
  }
}
```

### Errores

| Código | Condición                                        |
|--------|--------------------------------------------------|
| `400`  | Campos faltantes o inválidos                     |
| `404`  | Negocio o servicio no encontrado                 |
| `409`  | El turno ya fue tomado (conflicto de concurrencia)|
| `500`  | Error interno                                    |

---

## 4. Listar reservas del día

> ⚠️ **Eliminado.** `GET /api/:slug/bookings` exponía públicamente el nombre y el
> WhatsApp de todos los clientes (PII) sin autenticación. Se quitó. El panel del
> dueño usa el endpoint autenticado **`GET /api/dashboard/bookings?date=`**, que
> deriva el negocio de la sesión y no requiere `slug` en la URL.

---

## 5. Actualizar estado de reserva

**`PATCH /api/:slug/bookings/:bookingId`** · 🔒 **Requiere sesión**

Actualiza el estado de una reserva y registra el timestamp correspondiente.
Requiere estar autenticado como dueño del negocio (`slug`); de lo contrario
devuelve `401`/`404`. La llamada se hace desde el dashboard con la cookie de sesión.

### Parámetros de ruta

| Parámetro   | Tipo   | Descripción                    |
|-------------|--------|--------------------------------|
| `slug`      | string | Identificador del negocio      |
| `bookingId` | string | ID de la reserva               |

### Body `application/json`

```json
{
  "status": "CONFIRMED"
}
```

Para cancelaciones:

```json
{
  "status": "CANCELLED",
  "cancellationReason": "Cliente no pudo asistir"
}
```

| Campo                | Tipo   | Requerido | Descripción                                                         |
|----------------------|--------|-----------|---------------------------------------------------------------------|
| `status`             | string | Sí        | Nuevo estado: `CONFIRMED`, `CANCELLED`, `COMPLETED` o `NO_SHOW`    |
| `cancellationReason` | string | No        | Motivo (solo aplica cuando `status` es `CANCELLED`)                 |

### Timestamps que se registran automáticamente

| Status      | Campo que se actualiza |
|-------------|------------------------|
| `CONFIRMED` | `confirmedAt`          |
| `CANCELLED` | `cancelledAt`          |
| `COMPLETED` | `completedAt`          |
| `NO_SHOW`   | _(ninguno)_            |

### Respuesta exitosa `200`

```json
{
  "booking": {
    "id":                 "cmqb6bldj0001kwuqpscjtper",
    "status":             "CONFIRMED",
    "confirmedAt":        "2026-06-12T17:10:49.790Z",
    "cancelledAt":        null,
    "completedAt":        null,
    "cancellationReason": null,
    "service": { "id": "...", "name": "Corte de cabello", "duration": 30, "price": 50000 },
    "client":  { "id": "...", "name": "Juan Pérez", "whatsapp": "595981123456" }
  }
}
```

### Errores

| Código | Condición                                              |
|--------|--------------------------------------------------------|
| `400`  | `status` faltante o inválido                           |
| `401`  | No autenticado                                         |
| `404`  | Negocio o reserva no encontrada, o no sos el dueño del negocio |
| `500`  | Error interno                                          |
