"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { searchBrave } from "@/lib/jobs/brave-search"
import { buildJobSearchQuery, type ProfileSearchContext } from "@/lib/jobs/query-builder"
import { normalizeBraveResult } from "@/lib/jobs/normalize"
import type { Database, JobPlatform } from "@/lib/supabase/database.types"

const CACHE_WINDOW_MS = 6 * 60 * 60 * 1000 // 6 hours

type JobRow = Database["public"]["Tables"]["jobs"]["Row"]

export type PlatformFetchMeta = {
  cached: boolean
  count: number
  error?: string
}

type FetchJobsResult =
  | {
      success: true
      jobs: JobRow[]
      meta: Record<JobPlatform, PlatformFetchMeta>
    }
  | { success: false; error: string }

/**
 * For each requested platform: reuse cached jobs if the most recent fetch
 * for that platform is under 6 hours old, otherwise call Brave Search,
 * normalize + upsert the results, and bump `fetched_at`. Returns the
 * combined job list across all requested platforms either way.
 */
export async function fetchJobsAction(
  platforms: JobPlatform[]
): Promise<FetchJobsResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "You must be signed in to search for jobs." }
  }

  if (platforms.length === 0) {
    return { success: false, error: "Select at least one job platform." }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "skills, headline, location, preferred_location, target_role, job_type_preference"
    )
    .eq("id", user.id)
    .maybeSingle()

  const searchContext: ProfileSearchContext = {
    targetRole: profile?.target_role ?? null,
    headline: profile?.headline ?? null,
    preferredLocation: profile?.preferred_location ?? null,
    location: profile?.location ?? null,
    jobTypePreference: profile?.job_type_preference ?? null,
    skills: profile?.skills ?? [],
  }

  const meta = {} as Record<JobPlatform, PlatformFetchMeta>

  for (const platform of platforms) {
    const { data: mostRecent } = await supabase
      .from("jobs")
      .select("fetched_at")
      .eq("user_id", user.id)
      .eq("platform", platform)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const isFresh =
      !!mostRecent &&
      Date.now() - new Date(mostRecent.fetched_at).getTime() < CACHE_WINDOW_MS

    if (isFresh) {
      meta[platform] = { cached: true, count: 0 }
      continue
    }

    const query = buildJobSearchQuery(platform, searchContext)
    const searchResult = await searchBrave(query)

    if (!searchResult.success) {
      // Keep whatever was cached before (even if stale) rather than wiping
      // the list on a transient API failure.
      meta[platform] = { cached: !!mostRecent, count: 0, error: searchResult.error }
      continue
    }

    const rows = searchResult.results.map((result) => ({
      ...normalizeBraveResult({ platform, result, skills: searchContext.skills }),
      user_id: user.id,
      fetched_at: new Date().toISOString(),
    }))

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("jobs")
        .upsert(rows, { onConflict: "user_id,job_url" })

      if (upsertError) {
        meta[platform] = {
          cached: !!mostRecent,
          count: 0,
          error: `Failed to save jobs: ${upsertError.message}`,
        }
        continue
      }
    }

    meta[platform] = { cached: false, count: rows.length }
  }

  const { data: jobs, error: fetchError } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", user.id)
    .in("platform", platforms)
    .order("match_score", { ascending: false })
    .order("fetched_at", { ascending: false })

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }

  revalidatePath("/dashboard/jobs")

  return { success: true, jobs: jobs ?? [], meta }
}

export async function toggleSaveJobAction(
  jobId: string,
  saved: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "You must be signed in to do this." }
  }

  const { error } = await supabase
    .from("jobs")
    .update({ saved_status: saved })
    .eq("id", jobId)
    .eq("user_id", user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/dashboard/jobs")
  return { success: true }
}

export async function markJobAppliedAction(
  jobId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "You must be signed in to do this." }
  }

  const { error } = await supabase
    .from("jobs")
    .update({ applied_status: "applied" })
    .eq("id", jobId)
    .eq("user_id", user.id)
    .eq("applied_status", "not_applied")

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/dashboard/jobs")
  revalidatePath("/dashboard/status")
  return { success: true }
}
