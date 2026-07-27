"use client"

import * as React from "react"
import { BookmarkX } from "lucide-react"

import { JobListing } from "@/components/dashboard/jobs/job-listing"
import type { Database } from "@/lib/supabase/database.types"

type JobRow = Database["public"]["Tables"]["jobs"]["Row"]

export function SavedJobsList({ initialJobs }: { initialJobs: JobRow[] }) {
  const [jobs, setJobs] = React.useState(initialJobs)

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed py-16 text-center">
        <BookmarkX className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">No saved jobs yet</p>
        <p className="text-sm text-muted-foreground">
          Save a role from the Jobs page to find it here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <JobListing
          key={job.id}
          job={job}
          onSavedChange={(saved) => {
            if (!saved) {
              setJobs((currentJobs) => currentJobs.filter((item) => item.id !== job.id))
            }
          }}
        />
      ))}
    </div>
  )
}
