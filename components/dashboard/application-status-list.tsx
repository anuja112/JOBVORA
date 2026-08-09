"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  ExternalLink,
  FileSearch,
  Loader2,
  Send,
  UserRoundPen,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { continueApplication, refreshApplicationFields } from "@/app/actions/applications"
import { MissingFieldsDialog } from "@/components/dashboard/missing-fields-dialog"

type Application = {
  id: string
  status: string
  platform: string
  application_url: string
  browserbase_session_id: string | null
  pending_action: string | null
  error_message: string | null
  missing_fields: unknown
  jobs?: { title: string; company: string | null } | null
}
type Field = { key: string; label: string; type?: string }

const statusMeta: Record<string, { label: string; className: string; icon: typeof FileSearch; description: string }> = {
  detecting_fields: { label: "Inspecting form", className: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300", icon: FileSearch, description: "Finding required fields and matching your profile." },
  missing_profile_info: { label: "Profile details needed", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300", icon: UserRoundPen, description: "Add the missing details before this application can continue." },
  ready_to_apply: { label: "Ready to submit", className: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300", icon: ClipboardCheck, description: "Your profile matches the form and is ready for approval." },
  submitting: { label: "Submitting", className: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300", icon: Send, description: "The AI agent is completing the application." },
  submitted: { label: "Submitted", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", icon: CheckCircle2, description: "The application was submitted successfully." },
  failed: { label: "Needs attention", className: "border-destructive/30 bg-destructive/10 text-destructive", icon: CircleAlert, description: "The automation could not finish this application." },
}

function isAwaitingVerification(application: Application) {
  return application.pending_action === "captcha_verification"
}

function isAwaitingManualFormCompletion(application: Application) {
  return application.pending_action === "manual_form_completion" || application.pending_action === "manual_submission_review"
}

function needsManualFieldCompletion(application: Application) {
  return application.pending_action === "manual_form_completion"
}

export function ApplicationStatusList({ applications }: { applications: Application[] }) {
  const [pending, setPending] = React.useState<string | null>(null)
  const [submittingIds, setSubmittingIds] = React.useState<Set<string>>(new Set())
  const [editing, setEditing] = React.useState<Application | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const autoOpenedApplicationId = React.useRef<string | null>(null)
  const router = useRouter()
  const hasActiveWorkflow = applications.some((application) =>
    (application.status === "detecting_fields" || application.status === "submitting")
    && !isAwaitingVerification(application)
  )

  // Inngest updates the database from a separate process, so a server-action
  // revalidation cannot update an already-open browser tab. Poll only while an
  // application is actively being inspected or submitted.
  React.useEffect(() => {
    // A full reload would destroy text the applicant is entering in the
    // missing-details dialog. Resume background polling after it closes.
    if (editing) return
    if (!hasActiveWorkflow) return

    const interval = window.setInterval(() => router.refresh(), 3_000)
    return () => window.clearInterval(interval)
  }, [hasActiveWorkflow, router, editing])


  React.useEffect(() => {
    const applicationNeedingDetails = applications.find((application) => application.status === "missing_profile_info")
    if (!applicationNeedingDetails) {
      autoOpenedApplicationId.current = null
      return
    }
    if (autoOpenedApplicationId.current !== applicationNeedingDetails.id) {
      autoOpenedApplicationId.current = applicationNeedingDetails.id
      setEditing(applicationNeedingDetails)
    }
  }, [applications])

  async function submit(id: string) {
    setPending(id); setActionError(null)
    setSubmittingIds((current) => new Set(current).add(id))
    try {
      const result = await continueApplication(id)
      if (!result.success) throw new Error(result.error)
      router.refresh()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not start the submission.")
      setSubmittingIds((current) => { const next = new Set(current); next.delete(id); return next })
    } finally {
      setPending(null)
    }
  }
  async function refreshQuestions(id: string) {
    setPending(id); setActionError(null)
    try {
      const result = await refreshApplicationFields(id)
      if (!result.success) throw new Error(result.error)
      router.refresh()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not refresh the application questions.")
    } finally {
      setPending(null)
    }
  }
  if (!applications.length) {
    return <div className="rounded-4xl border border-dashed bg-card px-6 py-16 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Bot className="size-6" /></div><h2 className="mt-4 font-semibold">No AI applications yet</h2><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Choose “Apply automatically using AI Agent” from any job to track its progress here.</p><Link href="/dashboard/jobs" className="mt-5 inline-flex h-9 items-center rounded-4xl bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80">Browse jobs</Link></div>
  }

  return <>
    <div aria-live="polite" className="sr-only">{hasActiveWorkflow ? "Application workflow is in progress." : "Application workflow updated."}</div>
    {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
    <div className="space-y-3">
      {applications.map((application) => {
        const displayStatus = submittingIds.has(application.id) ? "submitting" : application.status
        const meta = statusMeta[displayStatus] ?? statusMeta.failed
        const Icon = meta.icon
        const fields = Array.isArray(application.missing_fields) ? application.missing_fields as { label?: string }[] : []
        const liveVerificationPending = isAwaitingVerification(application)
        const manualFormPending = isAwaitingManualFormCompletion(application)
        const missingFormFields = needsManualFieldCompletion(application)
        // Form discovery is deliberately not shown live. A live link appears
        // only after the applicant explicitly starts submission.
        const liveReviewAvailable = Boolean(application.browserbase_session_id) && displayStatus === "submitting"
        const description = liveVerificationPending
          ? "The AI is paused until you complete a human verification step in the live browser."
          : manualFormPending
          ? missingFormFields
            ? "The AI pre-filled what it could. Complete the remaining required fields in the live form, then press the employer's Submit button."
            : "The AI clicked Submit, but the employer did not return a confirmation we can safely verify. Review the live form and submit it if the button is still shown."
          : displayStatus === "failed"
          ? "The application could not finish. Retry the AI flow or apply directly on the employer's site."
          : meta.description

        return <article key={application.id} className="rounded-4xl border bg-card p-5 shadow-sm ring-1 ring-foreground/5 transition-shadow hover:shadow-md dark:ring-foreground/10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted"><Icon className="size-5 text-muted-foreground" /></div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-semibold">{application.jobs?.title ?? "Job application"}</h2><Badge variant="outline" className={meta.className}>{liveVerificationPending ? "Verification required" : manualFormPending ? "Your action needed" : meta.label}</Badge></div>
                <p className="mt-0.5 text-sm text-muted-foreground">{application.jobs?.company ?? application.platform}</p>
                <p aria-live="polite" className="mt-2 text-sm text-foreground/70">{description}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {liveReviewAvailable && application.browserbase_session_id && <a className="inline-flex h-9 items-center gap-2 rounded-4xl border bg-background px-3 text-sm font-medium shadow-xs hover:bg-muted" href={`/api/browserbase/live/${application.browserbase_session_id}`} target="_blank" rel="noreferrer">{manualFormPending ? (missingFormFields ? "Complete form" : "Review form") : "Watch submission"} <ExternalLink className="size-3" /></a>}
              {displayStatus === "missing_profile_info" && <Button variant="outline" onClick={() => setEditing(application)}>Fill missing data</Button>}
              {displayStatus === "ready_to_apply" && <Button onClick={() => submit(application.id)} disabled={pending === application.id}>{pending === application.id ? <Loader2 className="animate-spin" /> : <Send />} Submit application</Button>}
              {displayStatus === "failed" && <><Button variant="outline" onClick={() => refreshQuestions(application.id)} disabled={pending === application.id}>Try again</Button><a className="inline-flex h-9 items-center gap-2 rounded-4xl border bg-background px-3 text-sm font-medium shadow-xs hover:bg-muted" href={application.application_url} target="_blank" rel="noreferrer">Apply manually <ExternalLink className="size-3" /></a></>}
              {liveVerificationPending && application.browserbase_session_id && <a className="inline-flex h-9 items-center gap-2 rounded-4xl bg-primary px-3 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90" href={`/api/browserbase/live/${application.browserbase_session_id}`} target="_blank" rel="noreferrer">Complete verification <ExternalLink className="size-3" /></a>}
            </div>
          </div>
          {liveReviewAvailable && !manualFormPending && !liveVerificationPending && <div className="mt-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm text-foreground/80">The AI is submitting in a live browser. You can watch the submission process after it starts.</div>}
          {manualFormPending && <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-foreground/80">Open <span className="font-medium">{missingFormFields ? "Complete form" : "Review form"}</span>, {missingFormFields ? "finish every required field shown by the employer" : "confirm the employer form is complete"}, and press its final Submit button. The session remains open for two minutes.</div>}
          {liveVerificationPending && <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground/80">Complete the verification in the live browser. The AI will then resume form discovery or submission automatically.</div>}
          {displayStatus === "missing_profile_info" && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-800 dark:text-amber-300"><span>{fields.length} application detail{fields.length === 1 ? " is" : "s are"} needed before the AI can continue.</span><button className="font-medium underline" onClick={() => refreshQuestions(application.id)} disabled={pending === application.id}>Refresh questions</button></div>}
        </article>
      })}
    </div>
    {editing && <MissingFieldsDialog applicationId={editing.id} fields={Array.isArray(editing.missing_fields) ? editing.missing_fields as Field[] : []} open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} onSaved={() => router.refresh()} />}
  </>
}
