import { describe, it, expect } from "vitest";
import { detectSinkFormat, formatSinkBody } from "@/lib/logger";

describe("detectSinkFormat", () => {
  it("detecta Slack por el host", () => {
    expect(detectSinkFormat("https://hooks.slack.com/services/T/B/X")).toBe("slack");
  });
  it("detecta Discord por el host", () => {
    expect(detectSinkFormat("https://discord.com/api/webhooks/123/abc")).toBe("discord");
  });
  it("cae a json para una URL genérica", () => {
    expect(detectSinkFormat("https://in.logtail.com/")).toBe("json");
  });
  it("el override de env gana sobre la auto-detección", () => {
    expect(detectSinkFormat("https://hooks.slack.com/x", "json")).toBe("json");
    expect(detectSinkFormat("https://collector.example.com", "discord")).toBe("discord");
  });
  it("ignora un override inválido", () => {
    expect(detectSinkFormat("https://hooks.slack.com/x", "bogus")).toBe("slack");
  });
});

describe("formatSinkBody", () => {
  const record = {
    level: "error",
    timestamp: "2026-06-16T00:00:00.000Z",
    context: "[bookings]",
    error: "boom",
    stack: "Error: boom\n  at x",
    bookingId: "b1",
  };

  it("json: manda el registro crudo tal cual", () => {
    expect(formatSinkBody(record, "json")).toBe(JSON.stringify(record));
  });

  it("slack: envuelve un texto legible en { text } sin stack", () => {
    const body = JSON.parse(formatSinkBody(record, "slack")) as { text: string };
    expect(body.text).toContain("ERROR");
    expect(body.text).toContain("[bookings]");
    expect(body.text).toContain("boom");
    expect(body.text).toContain("bookingId"); // meta incluida
    expect(body.text).not.toContain("at x");   // stack omitido del chat
  });

  it("discord: usa { content }", () => {
    const body = JSON.parse(formatSinkBody(record, "discord")) as { content: string };
    expect(body.content).toContain("[bookings]");
  });

  it("trunca mensajes largos para Discord", () => {
    const big = { level: "error", context: "x", error: "z".repeat(5000) };
    const body = JSON.parse(formatSinkBody(big, "discord")) as { content: string };
    expect(body.content.length).toBeLessThanOrEqual(1900);
  });
});
