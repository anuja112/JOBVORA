import { BillingDashboard } from "@/components/dashboard/billing-dashboard"
import { getSubscriptionSummary } from "@/lib/supabase/queries/subscriptions"
import { createClient } from "@/lib/supabase/server"

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const summary = await getSubscriptionSummary(supabase, user.id)
  return <BillingDashboard summary={summary} />
}
