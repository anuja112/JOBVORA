import type { JobPlatform } from "@/lib/supabase/database.types"
import { getPlatformConfig } from "@/lib/jobs/platforms"

export type ProfileSearchContext = {
  targetRole: string | null
  headline: string | null
  preferredLocation: string | null
  location: string | null
  jobTypePreference: string | null
  skills: string[]
}

/**
 * Builds a platform-specific Brave Search query from the user's profile,
 * following the `site:<board> "<role>" "<location>"` pattern — e.g.:
 *   (site:job-boards.greenhouse.io OR site:boards.greenhouse.io) "React Frontend Developer" React "Remote" "San Francisco"
 */
export function buildJobSearchQuery(
  platform: JobPlatform,
  context: ProfileSearchContext
): string {
  const { siteFilter } = getPlatformConfig(platform)

  const role = (context.targetRole || context.headline || "Software Engineer").trim()
  const location = (context.preferredLocation || context.location || "Remote").trim()
  const topSkills = context.skills.slice(0, 2).join(" ").trim()
  const jobType = context.jobTypePreference?.trim()

  const parts = [
    siteFilter,
    `"${role}"`,
    topSkills,
    `"${location}"`,
    jobType ? `"${jobType}"` : null,
  ].filter((part): part is string => Boolean(part && part.length > 0))

  return parts.join(" ")
}
