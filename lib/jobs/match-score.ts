import type { ParsedResume } from "@/lib/resume/schema"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

export type ResumeMatchProfile = Pick<ParsedResume, "headline" | "summary" | "skills" | "workExperience" | "education" | "projects" | "certifications">

const STOP_WORDS = new Set("a an and are as at be by for from in is it of on or that the to with you your our we will role job work years experience required preferred plus team candidate position company remote full time".split(" "))

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim()
}

function terms(value: string) {
  return new Set(normalize(value).split(" ").filter((term) => term.length > 2 && !STOP_WORDS.has(term)))
}

function overlap(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0
  let matched = 0
  for (const term of left) if (right.has(term)) matched += 1
  return matched / left.size
}

export function resumeProfileText(profile: ResumeMatchProfile) {
  return [
    profile.headline,
    profile.summary,
    ...profile.skills,
    ...profile.workExperience.flatMap((item) => [item.title, item.company, item.description ?? "", ...item.bullets]),
    ...profile.education.flatMap((item) => [item.degree ?? "", item.fieldOfStudy ?? "", item.description ?? ""]),
    ...profile.projects.flatMap((item) => [item.name, item.description ?? "", ...item.techStack]),
    ...profile.certifications.flatMap((item) => [item.name, item.issuer ?? ""]),
  ].filter(Boolean).join(" ")
}

/**
 * An evidence-based score over the parsed resume, not a cosmetic percentage.
 * Skills carry most weight; role, experience, education and resume keywords
 * provide additional independent evidence. No minimum score is imposed.
 */
export function calculateResumeJobMatch(profile: ResumeMatchProfile, job: { title: string; description?: string | null; tags?: string[] }) {
  const jobText = `${job.title} ${job.description ?? ""} ${(job.tags ?? []).join(" ")}`
  const normalizedJob = normalize(jobText)
  const skills = [...new Set(profile.skills.map(normalize).filter(Boolean))]
  const matchedSkills = skills.filter((skill) => normalizedJob.includes(skill))
  const skillScore = skills.length ? matchedSkills.length / skills.length : 0

  const resumeText = resumeProfileText(profile)
  const keywordScore = overlap(terms(resumeText), terms(jobText))
  const roleScore = overlap(terms(profile.headline ?? ""), terms(job.title)) || Math.max(...profile.workExperience.map((item) => overlap(terms(item.title), terms(job.title))), 0)
  const educationText = profile.education.map((item) => `${item.degree ?? ""} ${item.fieldOfStudy ?? ""}`).join(" ")
  const educationScore = /degree|bachelor|master|b\.?tech|b\.?sc|computer science|engineering/i.test(jobText) ? overlap(terms(educationText), terms(jobText)) : 0
  const experienceScore = profile.workExperience.length > 0 && /senior|lead|principal|staff|manager|junior|entry|intern|years? of experience/i.test(jobText) ? 1 : 0

  return Math.round(Math.min(100, (skillScore * 55) + (keywordScore * 20) + (roleScore * 15) + (educationScore * 5) + (experienceScore * 5)))
}

export async function recalculateJobMatchScores(supabase: SupabaseClient<Database>, userId: string, profile: ResumeMatchProfile) {
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("id, title, description, tags")
    .eq("user_id", userId)
  if (error) return { error: error.message }

  const updates = await Promise.all((jobs ?? []).map((job) => {
    const tags = Array.isArray(job.tags) ? job.tags.filter((tag) => typeof tag === "string") as string[] : []
    return supabase
      .from("jobs")
      .update({ match_score: calculateResumeJobMatch(profile, { title: job.title, description: job.description, tags }) })
      .eq("id", job.id)
      .eq("user_id", userId)
  }))
  const failed = updates.find((result) => result.error)
  return { error: failed?.error?.message ?? null }
}
