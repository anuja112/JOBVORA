import { redirect } from "next/navigation"
import { Bot, CheckCircle2, ClipboardList, ListChecks, Send, TriangleAlert } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { ApplicationStatusList } from "@/components/dashboard/application-status-list"
import type { Database } from "@/lib/supabase/database.types"

// This page is polled while a Browserbase/Inngest workflow runs. It must never
// serve a cached server render, otherwise a verification handoff only appears
// after the applicant manually refreshes the browser.
export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function ApplicationStatusPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/sign-in")
  const { data } = await supabase.from("job_applications").select("id, status, platform, application_url, browserbase_session_id, error_message, missing_fields, jobs(title, company)").eq("user_id", user.id).order("updated_at", { ascending: false })
  const applications = (data ?? []) as unknown as Database["public"]["Tables"]["job_applications"]["Row"][]
  const total = applications.length
  const inProgress = applications.filter((application) => ["detecting_fields", "ready_to_apply", "submitting"].includes(application.status)).length
  const needsAttention = applications.filter((application) => ["missing_profile_info", "failed"].includes(application.status)).length
  const submitted = applications.filter((application) => application.status === "submitted").length
  const metrics = [
    { label: "Total applications", value: total, icon: ClipboardList, tone: "bg-slate-900/10 text-slate-700 dark:text-slate-200" },
    { label: "In progress", value: inProgress, icon: Send, tone: "bg-blue-500/10 text-blue-700" },
    { label: "Needs attention", value: needsAttention, icon: TriangleAlert, tone: "bg-amber-500/10 text-amber-700" },
    { label: "Submitted", value: submitted, icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-700" },
  ]
  return <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-8"><section className="relative overflow-hidden rounded-4xl border bg-card p-6 shadow-sm sm:p-8"><div className="absolute -right-8 -top-8 size-44 rounded-full bg-primary/10 blur-3xl"/><div className="relative"><div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Bot className="size-5" /></div><h1 className="mt-5 text-2xl font-semibold tracking-tight">Application command center</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Track every AI-assisted application, review a live form when needed, and resolve missing details before submission.</p><div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(({ label, value, icon: Icon, tone }) => <div key={label} className="rounded-2xl border bg-background p-4"><div className={`flex size-8 items-center justify-center rounded-xl ${tone}`}><Icon className="size-4" /></div><p className="mt-4 text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></div>)}</div></div></section><div className="flex items-end justify-between gap-4"><div><h2 className="text-xl font-semibold tracking-tight">Your applications</h2><p className="mt-1 text-sm text-muted-foreground">Complete details, review live forms, or retry a failed application.</p></div><ListChecks className="mb-1 size-5 shrink-0 text-muted-foreground" /></div><ApplicationStatusList applications={applications} /></div>
}
