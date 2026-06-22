import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de Prisma para no tocar la DB: solo nos interesa CÓMO se registra el intento.
// vi.hoisted: vi.mock se eleva al tope del archivo, así que la var del mock debe
// crearse también de forma hoisted para estar disponible dentro del factory.
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { bookingNotification: { create: createMock } } }));

import { notifyEmail } from "@/lib/notify";

beforeEach(() => {
  createMock.mockReset();
  createMock.mockResolvedValue({});
});

describe("notifyEmail — honestidad de señal", () => {
  it("modo dev (no enviado) registra success=false y NO finge éxito", async () => {
    const ok = await notifyEmail({
      bookingId: "b1",
      type: "CONFIRMATION",
      send: async () => ({ delivered: false, mode: "dev" }),
    });
    expect(ok).toBe(false);
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ bookingId: "b1", channel: "EMAIL", success: false }),
    });
    expect(createMock.mock.calls[0][0].data.error).toContain("dev");
  });

  it("envío real registra success=true sin error", async () => {
    const ok = await notifyEmail({
      bookingId: "b1",
      type: "CONFIRMATION",
      send: async () => ({ delivered: true, mode: "sent" }),
    });
    expect(ok).toBe(true);
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ channel: "EMAIL", success: true, error: null }),
    });
  });

  it("si el envío lanza, no propaga y registra success=false con el error", async () => {
    const ok = await notifyEmail({
      bookingId: "b1",
      type: "CONFIRMATION",
      send: async () => {
        throw new Error("resend 403");
      },
    });
    expect(ok).toBe(false);
    expect(createMock.mock.calls[0][0].data.success).toBe(false);
    expect(createMock.mock.calls[0][0].data.error).toContain("resend 403");
  });
});
