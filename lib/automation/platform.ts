export const AUTOMATION_PLATFORMS = ["greenhouse", "lever", "workable", "wellfound", "other"] as const
export type AutomationPlatform = (typeof AUTOMATION_PLATFORMS)[number]

export function detectApplicationPlatform(url: string): AutomationPlatform {
  const value = url.toLowerCase()
  if (value.includes("greenhouse.io")) return "greenhouse"
  if (value.includes("lever.co")) return "lever"
  if (value.includes("workable.com")) return "workable"
  if (value.includes("wellfound.com") || value.includes("angel.co")) return "wellfound"
  return "other"
}
