import { describe, it, expect } from "vitest";
import { hasAccess, effectiveTier, canUseFeature, serviceLimit, FREE_SERVICE_LIMIT } from "@/lib/plan";

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

describe("effectiveTier", () => {
  it("el trial vigente da acceso PRO aunque plan sea FREE", () => {
    expect(effectiveTier({ plan: "FREE", planExpiry: null, trialEndsAt: future })).toBe("PRO");
  });

  it("refleja el tier pago vigente", () => {
    expect(effectiveTier({ plan: "BASIC", planExpiry: future, trialEndsAt: null })).toBe("BASIC");
    expect(effectiveTier({ plan: "PRO", planExpiry: future, trialEndsAt: null })).toBe("PRO");
  });

  it("degrada a FREE al vencer trial y plan", () => {
    expect(effectiveTier({ plan: "BASIC", planExpiry: past, trialEndsAt: past })).toBe("FREE");
    expect(effectiveTier({ plan: "FREE", planExpiry: null, trialEndsAt: null })).toBe("FREE");
  });

  it("ignora plan pago si planExpiry es null", () => {
    expect(effectiveTier({ plan: "PRO", planExpiry: null, trialEndsAt: null })).toBe("FREE");
  });
});

describe("canUseFeature", () => {
  const free = { plan: "FREE", planExpiry: null, trialEndsAt: null };
  const basic = { plan: "BASIC", planExpiry: future, trialEndsAt: null };
  const pro = { plan: "PRO", planExpiry: future, trialEndsAt: null };

  it("FREE no tiene ninguna feature paga", () => {
    expect(canUseFeature(free, "reminders")).toBe(false);
    expect(canUseFeature(free, "export")).toBe(false);
    expect(canUseFeature(free, "stats")).toBe(false);
    expect(canUseFeature(free, "clientsCrm")).toBe(false);
    expect(canUseFeature(free, "reviews")).toBe(false);
    expect(canUseFeature(free, "retentionAnalytics")).toBe(false);
    expect(canUseFeature(free, "multiStaff")).toBe(false);
  });

  it("BASIC incluye operativas pero NO reseñas, retención ni multi-profesional", () => {
    expect(canUseFeature(basic, "reminders")).toBe(true);
    expect(canUseFeature(basic, "export")).toBe(true);
    expect(canUseFeature(basic, "stats")).toBe(true);
    expect(canUseFeature(basic, "clientsCrm")).toBe(true);
    expect(canUseFeature(basic, "reviews")).toBe(false);
    expect(canUseFeature(basic, "retentionAnalytics")).toBe(false);
    expect(canUseFeature(basic, "multiStaff")).toBe(false);
  });

  it("PRO incluye todo", () => {
    expect(canUseFeature(pro, "reviews")).toBe(true);
    expect(canUseFeature(pro, "retentionAnalytics")).toBe(true);
    expect(canUseFeature(pro, "multiStaff")).toBe(true);
  });

  it("el trial habilita features PRO", () => {
    expect(canUseFeature({ plan: "FREE", planExpiry: null, trialEndsAt: future }, "reviews")).toBe(true);
    expect(canUseFeature({ plan: "FREE", planExpiry: null, trialEndsAt: future }, "multiStaff")).toBe(true);
  });
});

describe("serviceLimit", () => {
  it("FREE está capado", () => {
    expect(serviceLimit({ plan: "FREE", planExpiry: null, trialEndsAt: null })).toBe(FREE_SERVICE_LIMIT);
  });

  it("planes pagos y trial son ilimitados", () => {
    expect(serviceLimit({ plan: "BASIC", planExpiry: future, trialEndsAt: null })).toBeNull();
    expect(serviceLimit({ plan: "FREE", planExpiry: null, trialEndsAt: future })).toBeNull();
  });
});
