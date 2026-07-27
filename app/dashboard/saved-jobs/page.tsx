import { redirect } from "next/navigation"

import { SavedJobsList } from "@/components/dashboard/jobs/saved-jobs-list"
import { createClient } from "@/lib/supabase/server"

export default async function SavedJobsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/sign-in")
  }

  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", user.id)
    .eq("saved_status", true)
    .order("fetched_at", { ascending: false })

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Saved jobs</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Roles you saved, with their latest application status.
        </p>
      </div>
      <SavedJobsList initialJobs={jobs ?? []} />
    </div>
  )
}
