"use client"

import * as React from "react"
import { AlertCircle, Search, SearchX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PlatformSelector } from "@/components/dashboard/jobs/platform-selector"
import { JobPreferencesForm } from "@/components/dashboard/jobs/job-preferences-form"
import { JobListing } from "@/components/dashboard/jobs/job-listing"
import { JobListingSkeletonGroup } from "@/components/dashboard/jobs/job-listing-skeleton"
import { fetchJobsAction } from "@/app/actions/jobs"
import { JOB_PLATFORMS } from "@/lib/jobs/platforms"
import type { Database, JobPlatform } from "@/lib/supabase/database.types"

type JobRow = Database["public"]["Tables"]["jobs"]["Row"]
type JobWithAutomation = JobRow & { automationStatus?: string | null }

export function JobsWorkspace({
  initialJobs,
  initialPlatforms,
  preferences,
}: {
  initialJobs: JobWithAutomation[]
  initialPlatforms: JobPlatform[]
  preferences: {
    targetRole: string
    preferredLocation: string
    jobTypePreference: string
  }
}) {
  const [selected, setSelected] = React.useState<JobPlatform[]>(
    initialPlatforms.length > 0
      ? initialPlatforms
      : JOB_PLATFORMS.map((p) => p.id)
  )
  const [jobs, setJobs] = React.useState<JobWithAutomation[]>(initialJobs)
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">(
    "idle"
  )
  const [error, setError] = React.useState<string | null>(null)
  const [hasSearched, setHasSearched] = React.useState(initialJobs.length > 0)

  async function handleFindJobs() {
    if (selected.length === 0) {
      setStatus("error")
      setError("Select at least one job platform to search.")
      return
    }
    setStatus("loading")
    setError(null)

    const result = await fetchJobsAction(selected)

    if (!result.success) {
      setStatus("error")
      setError(result.error)
      return
    }

    setJobs(result.jobs)
    setHasSearched(true)
    setStatus("idle")

    const hasPlatformErrors = Object.values(result.meta).some((meta) => meta.error)
    if (hasPlatformErrors) {
      setError(
        "We couldn't find jobs right now. Please try again in a few minutes."
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-4xl border bg-card p-6 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
        <div>
          <h2 className="text-sm font-semibold">Job platforms</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Select where you want to search, then hit Find Jobs.
          </p>
        </div>
        <PlatformSelector
          selected={selected}
          onChange={setSelected}
          disabled={status === "loading"}
        />

        <div className="border-t pt-4">
          <JobPreferencesForm initial={preferences} />
        </div>

        <Button
          onClick={handleFindJobs}
          disabled={status === "loading"}
          className="w-full gap-1.5 sm:w-auto"
        >
          <Search className="size-4" />
          {status === "loading" ? "Searching…" : "Find Jobs"}
        </Button>
      </div>

      {error && (
        <div className="flex min-w-0 items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 flex-1 break-words">{error}</span>
        </div>
      )}

      {status === "loading" && <JobListingSkeletonGroup />}

      {status !== "loading" && !error && jobs.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed py-16 text-center">
          <SearchX className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {hasSearched
              ? "No jobs found for the selected platforms and preferences."
              : "Select platforms above and click Find Jobs to get started."}
          </p>
        </div>
      )}

      {status !== "loading" && jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobListing key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  )
}
