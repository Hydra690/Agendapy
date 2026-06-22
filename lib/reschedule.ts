// Orquestación de la reprogramación de un turno, compartida por el endpoint
// self-service (manage/[token]/reschedule) y el del dashboard. Reusa el MISMO motor
// de slot/concurrencia que la creación (lib/booking-engine) y la infra de
// notificaciones (lib/notify), para no duplicar reglas ni garantías.

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addMinutes, dateToISODate } from "@/lib/date";
import { formatDayMonth } from "@/lib/format";
import { appBaseUrl } from "@/lib/url";
import { notifyWhatsApp, notifyEmail } from "@/lib/notify";
import { ownerRescheduleMessage, clientRescheduleMessage } from "@/lib/messages";
import { sendBookingRescheduleEmail } from "@/lib/email";
import {
  assertBookingTiming,
  assignAndReserveSlot,
  withSerializableRetry,
  SlotTakenError,
  SlotUnavailableError,
  BookingTooSoonError,
  PastDateError,
  BlockedDateError,
  StaffServiceMismatchError,
  NoStaffForServiceError,
} from "@/lib/booking-engine";

export interface RescheduleInput {
  booking: { id: string; date: Date; startTime: string; manageToken: string | null };
  business: {
    id: string;
    name: string;
    whatsapp: string | null;
    timezone: string;
    minBookingNoticeMinutes: number;
  };
  service: { id: string; name: string; duration: number; bufferMinutes: number };
  newDate: Date;
  newDateParam: string;
  newStartTime: string;
  requestedStaffId?: string;
}

/**
 * Mueve el turno al nuevo horario, atómicamente y con la misma protección de
 * concurrencia que una reserva nueva (la propia reserva se excluye del chequeo de
 * ocupación vía excludeBookingId). Guarda la fecha/hora previas + rescheduledAt, y
 * dispara las notificaciones (dueño siempre; cliente por WhatsApp y email si dejó).
 *
 * Lanza los errores de dominio de booking-engine; el caller los mapea a HTTP con
 * `rescheduleErrorResponse`.
 */
export async function performReschedule(input: RescheduleInput) {
  const { booking, business, service, newDate, newDateParam, newStartTime, requestedStaffId } = input;

  // Mismas reglas de tiempo que una reserva: no pasado, antelación mínima, no bloqueada.
  await assertBookingTiming(business, newDateParam, newDate, newStartTime);

  const newEndTime = addMinutes(newStartTime, service.duration);
  const prevDate = booking.date;
  const prevStartTime = booking.startTime;

  const updated = await withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const assignedStaffId = await assignAndReserveSlot(tx, {
          businessId: business.id,
          service: { id: service.id, duration: service.duration, bufferMinutes: service.bufferMinutes },
          bookingDate: newDate,
          startTime: newStartTime,
          requestedStaffId,
          excludeBookingId: booking.id,
        });

        try {
          return await tx.booking.update({
            where: { id: booking.id },
            data: {
              date: newDate,
              startTime: newStartTime,
              endTime: newEndTime,
              staffId: assignedStaffId,
              previousDate: prevDate,
              previousStartTime: prevStartTime,
              rescheduledAt: new Date(),
            },
            include: {
              service: { select: { id: true, name: true, duration: true, price: true } },
              client: { select: { id: true, name: true, whatsapp: true, email: true } },
            },
          });
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
            throw new SlotTakenError();
          }
          throw e;
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  );

  // ── Notificaciones (no bloqueantes; cada intento se persiste) ──
  const fromFechaLegible = formatDayMonth(dateToISODate(prevDate));
  const toFechaLegible = formatDayMonth(dateToISODate(newDate));
  const manageUrl = booking.manageToken ? `${appBaseUrl()}/turno/${booking.manageToken}` : null;

  // Al dueño (si configuró su WhatsApp).
  if (business.whatsapp) {
    void notifyWhatsApp({
      bookingId: booking.id,
      to: business.whatsapp,
      type: "RESCHEDULE",
      body: ownerRescheduleMessage({
        businessName: business.name,
        clientName: updated.client.name,
        clientWhatsapp: updated.client.whatsapp,
        serviceName: service.name,
        fromFechaLegible,
        fromStartTime: prevStartTime,
        toFechaLegible,
        toStartTime: newStartTime,
      }),
    });
  }

  // Al cliente por WhatsApp (degradación honesta sin Twilio).
  if (updated.client.whatsapp) {
    void notifyWhatsApp({
      bookingId: booking.id,
      to: updated.client.whatsapp,
      type: "RESCHEDULE",
      body: clientRescheduleMessage({
        clientName: updated.client.name,
        businessName: business.name,
        serviceName: service.name,
        toFechaLegible,
        toStartTime: newStartTime,
        manageUrl,
      }),
    });
  }

  // Al cliente por email (solo si dejó email; degradación honesta sin Resend).
  if (updated.client.email) {
    const clientEmailAddr = updated.client.email;
    void notifyEmail({
      bookingId: booking.id,
      type: "RESCHEDULE",
      send: () =>
        sendBookingRescheduleEmail(clientEmailAddr, {
          clientName: updated.client.name,
          businessName: business.name,
          serviceName: service.name,
          fechaLegible: toFechaLegible,
          startTime: newStartTime,
          manageUrl,
        }),
    });
  }

  return updated;
}

/**
 * Mapea los errores de dominio de la reprogramación a respuestas HTTP. Devuelve null
 * si el error no es uno conocido (el caller loguea y responde 500).
 */
export function rescheduleErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof PastDateError) {
    return NextResponse.json({ error: "No se puede reprogramar a una fecha pasada" }, { status: 400 });
  }
  if (error instanceof BlockedDateError) {
    return NextResponse.json({ error: error.reason ?? "Esa fecha no está disponible" }, { status: 400 });
  }
  if (error instanceof BookingTooSoonError) {
    return NextResponse.json({ error: "BOOKING_TOO_SOON", message: error.userMessage }, { status: 400 });
  }
  if (error instanceof SlotTakenError) {
    return NextResponse.json(
      { error: "SLOT_TAKEN", message: "Ese horario ya fue reservado. Por favor elegí otro." },
      { status: 409 }
    );
  }
  if (error instanceof SlotUnavailableError) {
    return NextResponse.json(
      { error: "SLOT_UNAVAILABLE", message: "Ese horario no está disponible." },
      { status: 400 }
    );
  }
  if (error instanceof StaffServiceMismatchError) {
    return NextResponse.json({ error: "Ese profesional no atiende este servicio" }, { status: 400 });
  }
  if (error instanceof NoStaffForServiceError) {
    return NextResponse.json({ error: "Ningún profesional ofrece este servicio" }, { status: 400 });
  }
  return null;
}
