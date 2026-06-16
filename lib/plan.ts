// Modelo de planes: tiers, features por tier y cuotas.
//
// Reglas de producto (ver enforcement):
//  - El trial (trialEndsAt vigente) da acceso COMPLETO (equivale a PRO) sin importar
//    el campo `plan`, que durante el trial sigue en FREE.
//  - Al vencer trial Y plan, se degrada a FREE: la cara pública y la gestión de
//    agenda NUNCA se bloquean; solo se gatean conveniencias del dueño y se aplica
//    cuota de servicios.
//  - WhatsApp de confirmación va en todos los tiers; los recordatorios 24h son
//    feature paga (gancho de upgrade + alinea costo Twilio con ingreso).

export type PlanTier = "FREE" | "BASIC" | "PRO";

export type Feature =
  | "reminders"            // recordatorios WhatsApp 24h (cron)
  | "export"              // export CSV
  | "stats"               // métricas: ingresos, hora pico, top servicio
  | "clientsCrm"          // detalle/notas de cliente
  | "reviews"             // módulo de reseñas
  | "retentionAnalytics"; // analítica de retención (clientes perdidos)

/** Cantidad máxima de servicios en FREE. null = sin límite. */
export const FREE_SERVICE_LIMIT = 2;

/** Features incluidas por cada tier. PRO ⊇ BASIC ⊇ FREE. */
const FEATURES: Record<PlanTier, ReadonlySet<Feature>> = {
  FREE: new Set<Feature>(),
  BASIC: new Set<Feature>(["reminders", "export", "stats", "clientsCrm"]),
  PRO: new Set<Feature>(["reminders", "export", "stats", "clientsCrm", "reviews", "retentionAnalytics"]),
};

export interface PlanInfo {
  plan: string;            // PlanType enum: FREE | BASIC | PRO
  planExpiry: Date | null;
  trialEndsAt: Date | null;
}

function isPaidTier(value: string): value is "BASIC" | "PRO" {
  return value === "BASIC" || value === "PRO";
}

/**
 * Tier EFECTIVO ahora mismo. Trial vigente ⇒ PRO. Plan pago vigente ⇒ ese tier.
 * En cualquier otro caso ⇒ FREE.
 */
export function effectiveTier(business: PlanInfo, now: Date = new Date()): PlanTier {
  if (business.trialEndsAt && business.trialEndsAt > now) return "PRO";
  if (isPaidTier(business.plan) && business.planExpiry && business.planExpiry > now) {
    return business.plan;
  }
  return "FREE";
}

/** true si el negocio tiene algún acceso pago/trial vigente (cualquier tier ≠ FREE). */
export function hasAccess(business: PlanInfo, now: Date = new Date()): boolean {
  return effectiveTier(business, now) !== "FREE";
}

/** true si el tier efectivo incluye la feature pedida. */
export function canUseFeature(business: PlanInfo, feature: Feature, now: Date = new Date()): boolean {
  return FEATURES[effectiveTier(business, now)].has(feature);
}

/** Límite de servicios del tier efectivo. null = ilimitado. */
export function serviceLimit(business: PlanInfo, now: Date = new Date()): number | null {
  return effectiveTier(business, now) === "FREE" ? FREE_SERVICE_LIMIT : null;
}

/** Resumen del plan para enviar al cliente (UI) sin filtrar lógica interna. */
export function planSummary(business: PlanInfo, now: Date = new Date()) {
  const tier = effectiveTier(business, now);
  return {
    tier,
    onTrial: !!(business.trialEndsAt && business.trialEndsAt > now),
    trialEndsAt: business.trialEndsAt,
    planExpiry: business.planExpiry,
    features: [...FEATURES[tier]],
    serviceLimit: serviceLimit(business, now),
  };
}
