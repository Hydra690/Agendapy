interface PlanInfo {
  plan: string;         // PlanType enum: FREE | BASIC | PRO
  planExpiry: Date | null;
  trialEndsAt: Date | null;
}

export function hasAccess(business: PlanInfo): boolean {
  const now = new Date();
  if (business.plan !== "FREE" && business.planExpiry && business.planExpiry > now) return true;
  if (business.trialEndsAt && business.trialEndsAt > now) return true;
  return false;
}
