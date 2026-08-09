import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { OnboardingDialog } from "@/components/dashboard/onboarding-dialog"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user

  if (!user) {
    redirect("/sign-in")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .maybeSingle()

  const needsOnboarding = !profile?.onboarding_completed

  const displayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split("@")[0] ??
    "there"

  const sidebarUser = {
    name: displayName,
    email: user.email ?? "",
    avatarUrl: user.user_metadata?.avatar_url ?? null,
  }

  return (
    <SidebarProvider>
      <AppSidebar user={sidebarUser} />
      <SidebarInset>
        <DashboardHeader />
        <div className="min-w-0 flex-1 overflow-x-hidden">{children}</div>
      </SidebarInset>
      <OnboardingDialog open={needsOnboarding} />
    </SidebarProvider>
  )
}
