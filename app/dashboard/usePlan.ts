"use client";

// Hook cliente para conocer el plan efectivo del negocio (tier, features, cuota).
// Lee el resumen que expone GET /api/dashboard/business (campo `plan`). Lo usan las
// páginas que necesitan gatear UI según features que su propio endpoint no informa
// (ej. la lista de clientes, settings). Las páginas cuyo endpoint ya devuelve 403
// pueden detectar el bloqueo directamente sin este hook.

import { useState, useEffect } from "react";

export type PlanTier = "FREE" | "BASIC" | "PRO";

export interface PlanSummary {
  tier: PlanTier;
  onTrial: boolean;
  trialEndsAt: string | null;
  planExpiry: string | null;
  features: string[];
  serviceLimit: number | null;
}

export function usePlan() {
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard/business")
      .then(r => (r.ok ? (r.json() as Promise<{ plan: PlanSummary }>) : null))
      .then(data => { if (active && data?.plan) setPlan(data.plan); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const can = (feature: string): boolean => !!plan?.features.includes(feature);

  return { plan, loading, can };
}
