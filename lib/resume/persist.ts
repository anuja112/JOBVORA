import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, LinkItem } from "@/lib/supabase/database.types"
import type { ParsedResume } from "@/lib/resume/schema"
import { recalculateJobMatchScores } from "@/lib/jobs/match-score"

/**
 * Writes resume/profile data into `profiles` and the child tables
 * (work_experiences, educations, projects, certifications), replacing any
 * existing child rows for the user.
 *
 * - When called after a Gemini parse, pass `resumeId` + `markOnboardingComplete: true`
 *   so every new row is traceable back to the source resume and the
 *   onboarding gate unlocks.
 * - When called from a manual profile-form save, pass `resumeId: null` so
 *   edited rows aren't attributed to a resume that no longer matches them.
 *
 * Note: this always replaces the full set of child rows for the user, so a
 * resume re-parse (or a full-form save) overwrites previously saved
 * work/education/project/certification entries. Scalar profile fields
 * (name, headline, etc.) are only overwritten when the incoming value is
 * present, so a partial re-parse won't blank out a field with `null`.
 */
export async function persistResumeData(
  supabase: SupabaseClient<Database>,
  params: {
    userId: string
    resumeId: string | null
    data: ParsedResume
    markOnboardingComplete?: boolean
  }
) {
  const { userId, resumeId, data, markOnboardingComplete = false } = params

  const linksAsJson: LinkItem[] = data.links.map((link) => ({
    label: link.label,
    url: link.url,
  }))

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: data.fullName ?? undefined,
      headline: data.headline ?? undefined,
      email: data.email ?? undefined,
      phone: data.phone ?? undefined,
      location: data.location ?? undefined,
      summary: data.summary ?? undefined,
      skills: data.skills,
      links: linksAsJson,
      ...(resumeId ? { active_resume_id: resumeId } : {}),
      ...(markOnboardingComplete ? { onboarding_completed: true } : {}),
    })
    .eq("id", userId)

  if (profileError) {
    return { error: `Failed to save profile: ${profileError.message}` }
  }

  const childTableWrites = await Promise.all([
    replaceWorkExperiences(
      supabase,
      userId,
      data.workExperience.map((item, index) => ({
        user_id: userId,
        resume_id: resumeId,
        company: item.company,
        title: item.title,
        location: item.location,
        start_date: item.startDate,
        end_date: item.endDate,
        is_current: item.isCurrent,
        description: item.description,
        bullets: item.bullets,
        sort_order: index,
      }))
    ),
    replaceEducations(
      supabase,
      userId,
      data.education.map((item, index) => ({
        user_id: userId,
        resume_id: resumeId,
        institution: item.institution,
        degree: item.degree,
        field_of_study: item.fieldOfStudy,
        start_date: item.startDate,
        end_date: item.endDate,
        description: item.description,
        sort_order: index,
      }))
    ),
    replaceProjects(
      supabase,
      userId,
      data.projects.map((item, index) => ({
        user_id: userId,
        resume_id: resumeId,
        name: item.name,
        description: item.description,
        tech_stack: item.techStack,
        link: item.link,
        sort_order: index,
      }))
    ),
    replaceCertifications(
      supabase,
      userId,
      data.certifications.map((item, index) => ({
        user_id: userId,
        resume_id: resumeId,
        name: item.name,
        issuer: item.issuer,
        issue_date: item.issueDate,
        credential_url: item.credentialUrl,
        sort_order: index,
      }))
    ),
  ])

  const failedWrite = childTableWrites.find((result) => result.error)
  if (failedWrite?.error) {
    return { error: failedWrite.error }
  }

  const scoreUpdate = await recalculateJobMatchScores(supabase, userId, data)
  if (scoreUpdate.error) return { error: `Failed to update job match scores: ${scoreUpdate.error}` }

  return { error: null }
}

type WorkExperienceInsert =
  Database["public"]["Tables"]["work_experiences"]["Insert"]
type EducationInsert = Database["public"]["Tables"]["educations"]["Insert"]
type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"]
type CertificationInsert =
  Database["public"]["Tables"]["certifications"]["Insert"]

async function replaceWorkExperiences(
  supabase: SupabaseClient<Database>,
  userId: string,
  rows: WorkExperienceInsert[]
) {
  const { error: deleteError } = await supabase
    .from("work_experiences")
    .delete()
    .eq("user_id", userId)
  if (deleteError) {
    return { error: `Failed to update work experience: ${deleteError.message}` }
  }
  if (rows.length === 0) return { error: null }
  const { error: insertError } = await supabase
    .from("work_experiences")
    .insert(rows)
  if (insertError) {
    return { error: `Failed to save work experience: ${insertError.message}` }
  }
  return { error: null }
}

async function replaceEducations(
  supabase: SupabaseClient<Database>,
  userId: string,
  rows: EducationInsert[]
) {
  const { error: deleteError } = await supabase
    .from("educations")
    .delete()
    .eq("user_id", userId)
  if (deleteError) {
    return { error: `Failed to update education: ${deleteError.message}` }
  }
  if (rows.length === 0) return { error: null }
  const { error: insertError } = await supabase
    .from("educations")
    .insert(rows)
  if (insertError) {
    return { error: `Failed to save education: ${insertError.message}` }
  }
  return { error: null }
}

async function replaceProjects(
  supabase: SupabaseClient<Database>,
  userId: string,
  rows: ProjectInsert[]
) {
  const { error: deleteError } = await supabase
    .from("projects")
    .delete()
    .eq("user_id", userId)
  if (deleteError) {
    return { error: `Failed to update projects: ${deleteError.message}` }
  }
  if (rows.length === 0) return { error: null }
  const { error: insertError } = await supabase.from("projects").insert(rows)
  if (insertError) {
    return { error: `Failed to save projects: ${insertError.message}` }
  }
  return { error: null }
}

async function replaceCertifications(
  supabase: SupabaseClient<Database>,
  userId: string,
  rows: CertificationInsert[]
) {
  const { error: deleteError } = await supabase
    .from("certifications")
    .delete()
    .eq("user_id", userId)
  if (deleteError) {
    return { error: `Failed to update certifications: ${deleteError.message}` }
  }
  if (rows.length === 0) return { error: null }
  const { error: insertError } = await supabase
    .from("certifications")
    .insert(rows)
  if (insertError) {
    return { error: `Failed to save certifications: ${insertError.message}` }
  }
  return { error: null }
}
