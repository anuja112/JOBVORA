import type { SupabaseClient } from "@supabase/supabase-js"

import { getBillingPlan } from "@/lib/billing/plans"
import type { Database } from "@/lib/supabase/database.types"

type Client = SupabaseClient<Database>

export type SubscriptionSummary = {
  plan: ReturnType<typeof getBillingPlan>
  status: string
  paymentStatus: string
  customerId: string | null
  subscriptionId: string | null
  periodEnd: string | null
  usedToday: number
  remainingToday: number | null
}

export async function getSubscriptionSummary(supabase: Client, userId: string): Promise<SubscriptionSummary> {
  const today = new Date().toISOString().slice(0, 10)
  const [{ data: subscription }, { data: usage }] = await Promise.all([
    supabase.from("user_subscriptions").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("daily_apply_usage").select("ai_apply_count").eq("user_id", userId).eq("usage_date", today).maybeSingle(),
  ])
  const plan = getBillingPlan(subscription?.plan)
  const usedToday = usage?.ai_apply_count ?? 0
  return {
    plan,
    status: subscription?.subscription_status ?? "active",
    paymentStatus: subscription?.payment_status ?? "free",
    customerId: subscription?.stripe_customer_id ?? null,
    subscriptionId: subscription?.stripe_subscription_id ?? null,
    periodEnd: subscription?.current_period_end ?? null,
    usedToday,
    remainingToday: plan.limit === null ? null : Math.max(plan.limit - usedToday, 0),
  }
}
