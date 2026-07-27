import type { JobPlatform } from "@/lib/supabase/database.types"

export type PlatformConfig = {
  id: JobPlatform
  name: string
  logo: string
  /** OR'd `site:` filters passed straight into the Brave Search query. */
  siteFilter: string
  /** Used to parse the company name back out of a result URL. */
  companyUrlPattern: RegExp
}

export const JOB_PLATFORMS: PlatformConfig[] = [
  {
    id: "greenhouse",
    name: "Greenhouse",
    logo: "/platforms/greenhouse.svg",
    siteFilter: "(site:job-boards.greenhouse.io OR site:boards.greenhouse.io)",
    companyUrlPattern: /greenhouse\.io\/([^/]+)/i,
  },
  {
    id: "lever",
    name: "Lever",
    logo: "/platforms/lever.svg",
    siteFilter: "site:jobs.lever.co",
    companyUrlPattern: /jobs\.lever\.co\/([^/]+)/i,
  },
  {
    id: "workable",
    name: "Workable",
    logo: "/platforms/workable.svg",
    siteFilter: "site:apply.workable.com",
    companyUrlPattern: /apply\.workable\.com\/([^/]+)/i,
  },
  {
    id: "wellfound",
    name: "Wellfound",
    logo: "/platforms/wellfound.svg",
    siteFilter: "site:wellfound.com/jobs",
    companyUrlPattern: /wellfound\.com\/company\/([^/]+)/i,
  },
]

export function getPlatformConfig(platform: JobPlatform): PlatformConfig {
  const config = JOB_PLATFORMS.find((p) => p.id === platform)
  if (!config) {
    throw new Error(`Unknown job platform: ${platform}`)
  }
  return config
}
