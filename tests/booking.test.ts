import { describe, it, expect } from "vitest";
import { generateSlots, rangesOverlap, availableSlots, dayOfWeekUTC, canCancelNow, cancellationDeadline, unionSlots, staffCanDoService, pickAvailableStaff } from "@/lib/booking";

describe("generateSlots", () => {
  it("genera pasos de la duración dentro del intervalo", () => {
    expect(generateSlots("08:00", "10:00", 30)).toEqual(["08:00", "08:30", "09:00", "09:30"]);
  });
  it("no genera un slot que no entra completo antes del cierre", () => {
    expect(generateSlots("08:00", "09:00", 45)).toEqual(["08:00"]);
  });
  it("devuelve vacío con duración inválida", () => {
    expect(generateSlots("08:00", "18:00", 0)).toEqual([]);
  });
});

describe("rangesOverlap", () => {
  it("solape de distinta duración", () => {
    expect(rangesOverlap("10:30", "11:00", "10:00", "11:00")).toBe(true);
  });
  it("adyacentes no se pisan", () => {
    expect(rangesOverlap("10:30", "11:00", "10:00", "10:30")).toBe(false);
  });
});

describe("availableSlots", () => {
  it("descarta los slots pisados por una reserva más larga", () => {
    // Negocio 08:00-10:00, servicio 30min. Reserva existente 08:00-09:00 (60min).
    const slots = availableSlots([{ startTime: "08:00", endTime: "10:00" }], 30, 0, [
      { startTime: "08:00", endTime: "09:00" },
    ]);
    // 08:00 y 08:30 quedan pisados; 09:00 y 09:30 libres.
    expect(slots).toEqual(["09:00", "09:30"]);
  });
  it("sin reservas, devuelve todos", () => {
    expect(availableSlots([{ startTime: "08:00", endTime: "09:00" }], 30, 0, [])).toEqual(["08:00", "08:30"]);
  });

  it("turno partido: une dos bloques con pausa de almuerzo", () => {
    // 08:00-10:00 y 14:00-16:00, servicio 60min, sin reservas.
    const slots = availableSlots(
      [{ startTime: "08:00", endTime: "10:00" }, { startTime: "14:00", endTime: "16:00" }],
      60, 0, []
    );
    expect(slots).toEqual(["08:00", "09:00", "14:00", "15:00"]);
  });

  it("buffer: separa los slots por duración+buffer y no ofrece pasada la pausa", () => {
    // 08:00-10:00, servicio 30min + buffer 15min → paso 45min. El servicio (30) debe
    // entrar antes de las 10:00. Candidatos: 08:00, 08:45, 09:30 (09:30+30=10:00 ok).
    expect(availableSlots([{ startTime: "08:00", endTime: "10:00" }], 30, 15, [])).toEqual([
      "08:00", "08:45", "09:30",
    ]);
  });

  it("buffer: una reserva existente bloquea su colchón posterior", () => {
    // Servicio 30 + buffer 15. Existente 08:00-08:30 ocupa hasta 08:45 (fin+buffer).
    // 08:00 chocado; el próximo candidato del grid (08:45) queda libre.
    const slots = availableSlots([{ startTime: "08:00", endTime: "10:00" }], 30, 15, [
      { startTime: "08:00", endTime: "08:45" },
    ]);
    expect(slots).toEqual(["08:45", "09:30"]);
  });
});

describe("unionSlots", () => {
  it("une, deduplica y ordena los slots de varios profesionales", () => {
    expect(unionSlots([["09:00", "10:00"], ["10:00", "08:00"]])).toEqual(["08:00", "09:00", "10:00"]);
  });
  it("vacío si nadie tiene slots", () => {
    expect(unionSlots([[], []])).toEqual([]);
  });
});

describe("staffCanDoService", () => {
  it("sin servicios asignados, hace todos", () => {
    expect(staffCanDoService([], "svc-1")).toBe(true);
  });
  it("con servicios, solo los asignados", () => {
    expect(staffCanDoService(["svc-1", "svc-2"], "svc-1")).toBe(true);
    expect(staffCanDoService(["svc-2"], "svc-1")).toBe(false);
  });
});

describe("pickAvailableStaff", () => {
  const blocks = new Map<string, { startTime: string; endTime: string }[]>([
    ["a", [{ startTime: "08:00", endTime: "12:00" }]],
    ["b", [{ startTime: "08:00", endTime: "12:00" }]],
  ]);

  it("elige el primero del orden si está libre", () => {
    const occ = new Map();
    expect(pickAvailableStaff(["a", "b"], blocks, occ, "08:00", 30, 0)).toBe("a");
  });

  it("salta al siguiente si el primero está ocupado en ese slot", () => {
    const occ = new Map([["a", [{ startTime: "08:00", endTime: "08:30" }]]]);
    expect(pickAvailableStaff(["a", "b"], blocks, occ, "08:00", 30, 0)).toBe("b");
  });

  it("respeta el orden de preferencia (b antes que a)", () => {
    const occ = new Map();
    expect(pickAvailableStaff(["b", "a"], blocks, occ, "08:00", 30, 0)).toBe("b");
  });

  it("null si ninguno está libre en ese slot", () => {
    const occ = new Map([
      ["a", [{ startTime: "08:00", endTime: "08:30" }]],
      ["b", [{ startTime: "08:00", endTime: "08:30" }]],
    ]);
    expect(pickAvailableStaff(["a", "b"], blocks, occ, "08:00", 30, 0)).toBeNull();
  });

  it("null si el profesional no tiene bloques ese día", () => {
    expect(pickAvailableStaff(["c"], blocks, new Map(), "08:00", 30, 0)).toBeNull();
  });

  it("null si el slot cae fuera del horario del profesional", () => {
    expect(pickAvailableStaff(["a"], blocks, new Map(), "13:00", 30, 0)).toBeNull();
  });
});

describe("dayOfWeekUTC", () => {
  it("mapea correctamente", () => {
    expect(dayOfWeekUTC(new Date("2026-08-14T00:00:00Z"))).toBe("FRIDAY"); // 2026-08-14 es viernes
    expect(dayOfWeekUTC(new Date("2026-08-16T00:00:00Z"))).toBe("SUNDAY");
  });
});

describe("cancelación: deadline y ventana", () => {
  const appt = new Date("2026-08-14T15:00:00Z");

  it("el deadline es windowHours antes del turno", () => {
    expect(cancellationDeadline(appt, 2).toISOString()).toBe("2026-08-14T13:00:00.000Z");
    expect(cancellationDeadline(appt, 0).toISOString()).toBe("2026-08-14T15:00:00.000Z");
  });

  it("permite cancelar antes del deadline", () => {
    expect(canCancelNow(appt, 2, new Date("2026-08-14T12:59:00Z"))).toBe(true);
  });

  it("justo en el deadline todavía permite (límite inclusivo)", () => {
    expect(canCancelNow(appt, 2, new Date("2026-08-14T13:00:00Z"))).toBe(true);
  });

  it("rechaza pasado el deadline", () => {
    expect(canCancelNow(appt, 2, new Date("2026-08-14T13:00:01Z"))).toBe(false);
  });

  it("windowHours=0 permite hasta el mismo turno pero no después", () => {
    expect(canCancelNow(appt, 0, new Date("2026-08-14T15:00:00Z"))).toBe(true);
    expect(canCancelNow(appt, 0, new Date("2026-08-14T15:00:01Z"))).toBe(false);
  });
});
