import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { ProfileForm } from "@/components/dashboard/profile-form"
import type { ParsedResume } from "@/lib/resume/schema"
import type { LinkItem } from "@/lib/supabase/database.types"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { TriangleAlert } from "lucide-react"

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/sign-in")
  }

  const [profileRes, workRes, educationRes, projectsRes, certsRes, applicationsRes] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("work_experiences")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("educations")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("certifications")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true }),
      supabase.from("job_applications").select("id, missing_fields").eq("user_id", user.id).eq("status", "missing_profile_info"),
    ])

  const profile = profileRes.data
  const links = (profile?.links as LinkItem[] | null) ?? []

  const initialData: ParsedResume = {
    fullName: profile?.full_name ?? null,
    headline: profile?.headline ?? null,
    email: profile?.email ?? user.email ?? null,
    phone: profile?.phone ?? null,
    location: profile?.location ?? null,
    summary: profile?.summary ?? null,
    skills: profile?.skills ?? [],
    links: Array.isArray(links) ? links : [],
    workExperience: (workRes.data ?? []).map((row) => ({
      company: row.company,
      title: row.title,
      location: row.location,
      startDate: row.start_date,
      endDate: row.end_date,
      isCurrent: row.is_current,
      description: row.description,
      bullets: row.bullets,
    })),
    education: (educationRes.data ?? []).map((row) => ({
      institution: row.institution,
      degree: row.degree,
      fieldOfStudy: row.field_of_study,
      startDate: row.start_date,
      endDate: row.end_date,
      description: row.description,
    })),
    projects: (projectsRes.data ?? []).map((row) => ({
      name: row.name,
      description: row.description,
      techStack: row.tech_stack,
      link: row.link,
    })),
    certifications: (certsRes.data ?? []).map((row) => ({
      name: row.name,
      issuer: row.issuer,
      issueDate: row.issue_date,
      credentialUrl: row.credential_url,
    })),
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      {(applicationsRes.data?.length ?? 0) > 0 && <Alert className="mb-6 border-amber-500/30 bg-amber-500/5"><TriangleAlert/><AlertTitle>Complete your profile to continue applying</AlertTitle><AlertDescription>One or more applications need: {applicationsRes.data?.flatMap((item) => Array.isArray(item.missing_fields) ? (item.missing_fields as { label?: string }[]).map((field) => field.label).filter(Boolean) : []).join(", ")}. <Link href="/dashboard/status" className="font-medium underline">View applications</Link></AlertDescription></Alert>}
      <ProfileForm initialData={initialData} />
    </div>
  )
}
