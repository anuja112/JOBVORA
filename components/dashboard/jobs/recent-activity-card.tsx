import { Bookmark, CheckCircle2, History } from "lucide-react"

import type { Database } from "@/lib/supabase/database.types"

type JobRow = Database["public"]["Tables"]["jobs"]["Row"]

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function RecentActivityCard({ jobs }: { jobs: JobRow[] }) {
  const activity = jobs
    .filter((job) => job.saved_status || job.applied_status !== "not_applied")
    .sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())
    .slice(0, 5)

  return (
    <div className="rounded-4xl border bg-card p-5 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <History className="size-4 text-muted-foreground" />
        Recent activity
      </h3>

      {activity.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Saved and applied jobs will show up here.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {activity.map((job) => (
            <li key={job.id} className="flex items-start gap-2.5 text-xs">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/40 text-primary-foreground">
                {job.applied_status !== "not_applied" ? (
                  <CheckCircle2 className="size-3" />
                ) : (
                  <Bookmark className="size-3" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {job.title}
                </p>
                <p className="truncate text-muted-foreground">
                  {job.applied_status !== "not_applied" ? "Applied" : "Saved"}
                  {job.company ? ` · ${job.company}` : ""} ·{" "}
                  {timeAgo(job.fetched_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
