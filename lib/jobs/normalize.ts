import type { BraveWebResult } from "@/lib/jobs/brave-search"
import { getPlatformConfig } from "@/lib/jobs/platforms"
import type { Database, JobPlatform } from "@/lib/supabase/database.types"
import { calculateResumeJobMatch, type ResumeMatchProfile } from "@/lib/jobs/match-score"

type JobInsert = Database["public"]["Tables"]["jobs"]["Insert"]
type NormalizedJob = Omit<JobInsert, "user_id">

const JOB_TYPE_KEYWORDS = [
  "Full-time",
  "Part-time",
  "Contract",
  "Internship",
  "Freelance",
  "Remote",
  "Hybrid",
  "On-site",
]

const EXPERIENCE_KEYWORDS = [
  "Intern",
  "Entry-level",
  "Junior",
  "Associate",
  "Mid-level",
  "Senior",
  "Staff",
  "Principal",
  "Lead",
  "Director",
]

export function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
}
export function withTruncationMark(text: string): string {
  const trimmed = text.trim()
  if (trimmed === "") return trimmed
  if (/[.!?…]$/.test(trimmed)) return trimmed
  return `${trimmed}…`
}
function humanizeSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

/** Splits a Brave result title like "Frontend Developer - Acme Corp" into { role, company }. */
function splitTitle(title: string): { role: string; company: string | null } {
  const separators = [" - ", " – ", " | ", " at "]
  for (const sep of separators) {
    if (title.includes(sep)) {
      const [first, ...rest] = title.split(sep)
      return { role: first.trim(), company: rest.join(sep).trim() || null }
    }
  }
  return { role: title.trim(), company: null }
}

function extractCompany(platform: JobPlatform, url: string, fallback: string | null) {
  const { companyUrlPattern } = getPlatformConfig(platform)
  const match = url.match(companyUrlPattern)
  if (match?.[1]) {
    return humanizeSlug(decodeURIComponent(match[1]))
  }
  return fallback
}

function findKeyword(text: string, keywords: string[]): string | null {
  const lower = text.toLowerCase()
  return keywords.find((keyword) => lower.includes(keyword.toLowerCase())) ?? null
}

function extractSalary(text: string): string | null {
  const match = text.match(
    /\$\s?\d{2,3}(?:,\d{3})?k?(?:\s?-\s?\$?\s?\d{2,3}(?:,\d{3})?k?)?/i
  )
  return match ? match[0].replace(/\s+/g, " ").trim() : null
}

function matchSkillTags(text: string, skills: string[]): string[] {
  const lower = text.toLowerCase()
  return skills
    .filter((skill) => lower.includes(skill.toLowerCase()))
    .slice(0, 6)
}

export function normalizeBraveResult(params: {
  platform: JobPlatform
  result: BraveWebResult
  matchProfile: ResumeMatchProfile
}): NormalizedJob {
  const { platform, result, matchProfile } = params
  const cleanTitle = stripHtml(result.title)
  const cleanDescription = stripHtml(result.description ?? "")
  const { role, company } = splitTitle(cleanTitle)
  const combinedText = `${cleanTitle} ${cleanDescription}`

  return {
    platform,
    title: role || cleanTitle,
    company: extractCompany(platform, result.url, company),
    company_logo: null,
    location: null,
    salary: extractSalary(combinedText),
    job_type: findKeyword(combinedText, JOB_TYPE_KEYWORDS),
    experience_level: findKeyword(combinedText, EXPERIENCE_KEYWORDS),
    description: cleanDescription ? withTruncationMark(cleanDescription) : null,
    tags: matchSkillTags(combinedText, matchProfile.skills),
    match_score: calculateResumeJobMatch(matchProfile, { title: role || cleanTitle, description: cleanDescription }),
    job_url: result.url,
    source_url: result.url,
  }
}
