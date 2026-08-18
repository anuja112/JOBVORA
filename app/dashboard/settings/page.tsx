import { SettingsDashboard } from "@/components/dashboard/settings-dashboard"
import { createClient } from "@/lib/supabase/server"
import { getSubscriptionSummary } from "@/lib/supabase/queries/subscriptions"

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const [profileResult, summary] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
    getSubscriptionSummary(supabase, user.id),
  ])

  return (
    <SettingsDashboard
      initialData={{
        name:
          user.user_metadata?.full_name ??
          profileResult.data?.full_name ??
          user.email?.split("@")[0] ??
          "",
        email: user.email ?? "",
        phone: profileResult.data?.phone ?? "",
        avatarUrl: profileResult.data?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
        planName: summary.plan.name,
        accountStatus: summary.status,
      }}
    />
  )
}
