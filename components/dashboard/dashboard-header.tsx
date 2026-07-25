"use client"

import { usePathname } from "next/navigation"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

const pageTitles: Record<string, { title: string; description: string }> = {
  "/dashboard": {
    title: "Overview",
    description: "Your job search activity at a glance.",
  },
  "/dashboard/jobs": {
    title: "Jobs",
    description: "Discover and track roles matched to your profile.",
  },
  "/dashboard/resume": {
    title: "Resume",
    description: "Manage and tailor your resume with AI.",
  },
  "/dashboard/profile": {
    title: "Profile",
    description: "Your personal and professional details.",
  },
  "/dashboard/status": {
    title: "Application Status",
    description: "Track every application from submitted to offer.",
  },
  "/dashboard/billing": {
    title: "Billing & Credits",
    description: "Manage your plan, credits, and payment details.",
  },
  "/dashboard/settings": {
    title: "Profile Settings",
    description: "Update your account preferences.",
  },
}

export function DashboardHeader() {
  const pathname = usePathname()
  const page = pageTitles[pathname] ?? {
    title: "Dashboard",
    description: "",
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold tracking-tight">
          {page.title}
        </h1>
        {page.description ? (
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            {page.description}
          </p>
        ) : null}
      </div>
    </header>
  )
}
