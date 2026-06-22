import { describe, it, expect } from "vitest";
import {
  clientConfirmationMessage,
  ownerNewBookingMessage,
  ownerCancellationMessage,
  clientReminderMessage,
} from "@/lib/messages";

describe("clientConfirmationMessage", () => {
  const base = {
    clientName: "Juan",
    businessName: "Barber X",
    serviceName: "Corte",
    fechaLegible: "lunes, 5 de enero",
    startTime: "10:00",
  };

  it("incluye negocio, servicio, fecha, hora y estado pendiente", () => {
    const msg = clientConfirmationMessage(base);
    expect(msg).toContain("Barber X");
    expect(msg).toContain("Corte");
    expect(msg).toContain("lunes, 5 de enero");
    expect(msg).toContain("10:00");
    expect(msg).toContain("pendiente de confirmación");
  });

  it("agrega el link de gestión solo si hay manageUrl", () => {
    expect(clientConfirmationMessage(base)).not.toContain("http");
    const withUrl = clientConfirmationMessage({ ...base, manageUrl: "https://x.test/turno/abc" });
    expect(withUrl).toContain("https://x.test/turno/abc");
  });
});

describe("mensajes de dueño / recordatorio (regresión Fase 0)", () => {
  const base = {
    businessName: "Biz",
    clientName: "Ana",
    serviceName: "Limpieza",
    fechaLegible: "martes, 6 de enero",
    startTime: "09:30",
  };

  it("nueva reserva incluye el whatsapp del cliente solo si está presente", () => {
    expect(ownerNewBookingMessage({ ...base, clientWhatsapp: "0981111111" })).toContain("0981111111");
    expect(ownerNewBookingMessage(base)).not.toContain("·");
  });

  it("cancelación menciona la cancelación", () => {
    expect(ownerCancellationMessage(base).toLowerCase()).toContain("cancel");
  });

  it("recordatorio saluda al cliente y nombra el negocio", () => {
    const msg = clientReminderMessage({
      clientName: "Ana",
      businessName: "Biz",
      serviceName: "Limpieza",
      fechaLegible: "x",
      startTime: "09:30",
    });
    expect(msg).toContain("Ana");
    expect(msg).toContain("Biz");
  });
});
