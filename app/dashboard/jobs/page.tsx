import { redirect } from "next/navigation"
import { Briefcase, FileText, FolderKanban, GraduationCap, Link2, Sparkles, User } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { WelcomeBanner } from "@/components/dashboard/jobs/welcome-banner"
import { JobsWorkspace } from "@/components/dashboard/jobs/jobs-workspace"
import { RecentActivityCard } from "@/components/dashboard/jobs/recent-activity-card"
import {
  ProfileCompletenessCard,
  type CompletenessSection,
} from "@/components/dashboard/profile-completeness-card"
import { JOB_PLATFORMS } from "@/lib/jobs/platforms"
import type { LinkItem } from "@/lib/supabase/database.types"

function clamp(count: number, target: number) {
  return Math.min(100, (count / target) * 100)
}

export default async function JobsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/sign-in")
  }

  const [profileRes, jobsRes, workRes, eduRes, projRes, certRes] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("jobs")
        .select("*")
        .eq("user_id", user.id)
        .order("match_score", { ascending: false })
        .order("fetched_at", { ascending: false }),
      supabase
        .from("work_experiences")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("educations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("certifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ])

  const profile = profileRes.data
  const jobs = jobsRes.data ?? []
  const links = (profile?.links as LinkItem[] | null) ?? []

  const displayName =
    profile?.full_name?.split(" ")[0] ??
    user.user_metadata?.full_name?.split(" ")[0] ??
    user.email?.split("@")[0] ??
    "there"

  const completenessSections: CompletenessSection[] = [
    {
      key: "basic",
      label: "Basic info",
      icon: <User className="size-3" />,
      percent: clamp(
        [profile?.full_name, profile?.headline, profile?.email, profile?.phone, profile?.location].filter(
          Boolean
        ).length,
        5
      ),
    },
    {
      key: "summary",
      label: "Summary",
      icon: <FileText className="size-3" />,
      percent: clamp(profile?.summary?.trim().length ?? 0, 120),
    },
    {
      key: "skills",
      label: "Skills",
      icon: <Sparkles className="size-3" />,
      percent: clamp(profile?.skills?.length ?? 0, 6),
    },
    {
      key: "work",
      label: "Work experience",
      icon: <Briefcase className="size-3" />,
      percent: clamp(workRes.count ?? 0, 2),
    },
    {
      key: "education",
      label: "Education",
      icon: <GraduationCap className="size-3" />,
      percent: clamp(eduRes.count ?? 0, 1),
    },
    {
      key: "links",
      label: "Links",
      icon: <Link2 className="size-3" />,
      percent: clamp(Array.isArray(links) ? links.length : 0, 2),
    },
    {
      key: "other",
      label: "Projects & certifications",
      icon: <FolderKanban className="size-3" />,
      percent: clamp((projRes.count ?? 0) + (certRes.count ?? 0), 2),
    },
  ]

  const platformsWithCache = new Set(jobs.map((job) => job.platform))
  const initialPlatforms =
    platformsWithCache.size > 0
      ? JOB_PLATFORMS.map((p) => p.id).filter((id) => platformsWithCache.has(id))
      : []

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <WelcomeBanner name={displayName} />

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <JobsWorkspace
          initialJobs={jobs}
          initialPlatforms={initialPlatforms}
          preferences={{
            targetRole: profile?.target_role ?? "",
            preferredLocation: profile?.preferred_location ?? "",
            jobTypePreference: profile?.job_type_preference ?? "",
          }}
        />

        <div className="space-y-6 lg:sticky lg:top-20">
          <ProfileCompletenessCard sections={completenessSections} />
          <RecentActivityCard jobs={jobs} />
        </div>
      </div>
    </div>
  )
}
