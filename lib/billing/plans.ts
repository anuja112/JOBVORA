import type { SubscriptionPlan } from "@/lib/supabase/database.types"

export type BillingPlan = {
  id: SubscriptionPlan
  name: string
  limit: number | null
  amountCents: number
  interval: "month"
  description: string
  features: string[]
}

function envAmount(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

export const BILLING_PLANS: Record<SubscriptionPlan, BillingPlan> = {
  free: { id: "free", name: "Free", limit: 5, amountCents: 0, interval: "month", description: "Get started with AI-powered job applications",features: [
  "5 AI applications per day",
  "Profile-based job matching",
  "Automated form assistance",
  "Application tracking",
] },
  pro: { id: "pro", name: "Pro", limit: 25, amountCents: envAmount("STRIPE_PRO_AMOUNT_CENTS", 1900), interval: "month", description: "Apply to more jobs every day with advanced assistance",features: [
  "25 AI applications per day",
  "Profile-based job matching",
  "Automated form assistance",
  "Application tracking",
  "Priority support",
] },
  unlimited: { id: "unlimited", name: "Unlimited", limit: null, amountCents: envAmount("STRIPE_UNLIMITED_AMOUNT_CENTS", 4900), interval: "month", description: "Unlimited AI applications for an unrestricted job search",features: [
  "Unlimited AI applications",
  "Profile-based job matching",
  "Automated form assistance",
  "Application tracking",
  "Priority support",
] },
}

export function getBillingPlan(plan: string | null | undefined) {
  return BILLING_PLANS[plan as SubscriptionPlan] ?? BILLING_PLANS.free
}

export function formatPlanPrice(plan: BillingPlan) {
  return plan.amountCents === 0
    ? "Free"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(plan.amountCents / 100)
}
