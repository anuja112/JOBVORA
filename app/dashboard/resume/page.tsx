import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { ResumeList } from "@/components/dashboard/resume-list"

export default async function ResumePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/sign-in")
  }

  const { data: resumes } = await supabase
    .from("resumes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <ResumeList resumes={resumes ?? []} />
    </div>
  )
}
