import { describe, it, expect } from "vitest";
import { hasAccess } from "@/lib/plan";

const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 86_400_000);

describe("hasAccess", () => {
  it("permite durante el trial vigente aunque el plan sea FREE", () => {
    expect(hasAccess({ plan: "FREE", planExpiry: null, trialEndsAt: future })).toBe(true);
  });

  it("bloquea FREE con trial vencido", () => {
    expect(hasAccess({ plan: "FREE", planExpiry: null, trialEndsAt: past })).toBe(false);
    expect(hasAccess({ plan: "FREE", planExpiry: null, trialEndsAt: null })).toBe(false);
  });

  it("permite plan pago vigente", () => {
    expect(hasAccess({ plan: "PRO", planExpiry: future, trialEndsAt: null })).toBe(true);
  });

  it("bloquea plan pago vencido sin trial", () => {
    expect(hasAccess({ plan: "PRO", planExpiry: past, trialEndsAt: null })).toBe(false);
  });
});
