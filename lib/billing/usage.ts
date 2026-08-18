import type { SupabaseClient } from "@supabase/supabase-js"

import { getBillingPlan } from "@/lib/billing/plans"
import type { Database } from "@/lib/supabase/database.types"

export type UsageGate = { allowed: boolean; used: number; limit: number | null; remaining: number | null; planName: string }

export async function checkAndIncrementUsage(supabase: SupabaseClient<Database>, userId: string): Promise<UsageGate | { error: string }> {
  const { data, error } = await supabase.rpc("check_and_increment_ai_apply_usage", { p_user_id: userId })
  if (error) return { error: error.message }
  const result = (data && typeof data === "object" && !Array.isArray(data) ? data : {}) as Record<string, unknown>
  const { data: subscription } = await supabase.from("user_subscriptions").select("plan").eq("user_id", userId).maybeSingle()
  const plan = getBillingPlan(subscription?.plan)
  return {
    allowed: result.allowed === true,
    used: typeof result.used === "number" ? result.used : 0,
    limit: typeof result.limit === "number" ? result.limit : null,
    remaining: typeof result.remaining === "number" ? result.remaining : null,
    planName: plan.name,
  }
}

export function usageLimitMessage(gate: UsageGate) {
  if (gate.planName === "Free") return "You have used all 5 AI applications available today on the Free plan. Upgrade to Pro for 25 daily applications."
  if (gate.planName === "Pro") return "You have used all 25 AI applications available today on the Pro plan. Upgrade to Unlimited for unrestricted applications."
  return "Your AI application limit has been reached for today."
}
