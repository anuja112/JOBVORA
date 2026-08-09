import { createAdminClient } from "@/lib/supabase/admin"
import { inngest } from "@/lib/inngest/client"
import { withBrowserbasePage } from "@/lib/automation/browser"
import { detectRequiredFields, fillAndSubmit, isApplicationUnavailable, openApplicationForm, requiresHumanVerification, waitForHumanVerification, waitForManualApplicationSubmission, waitForManualVerification } from "@/lib/automation/handlers"
import { mapRequiredFields, type RequiredField } from "@/lib/automation/field-mapper"
import { detectApplicationPlatform } from "@/lib/automation/platform"
import { downloadResumeBuffer } from "@/lib/resume/storage"
import type { Database } from "@/lib/supabase/database.types"

type ApplicationWithProfile = Database["public"]["Tables"]["job_applications"]["Row"] & {
  profiles: Database["public"]["Tables"]["profiles"]["Row"]
  resumes: Database["public"]["Tables"]["resumes"]["Row"] | null
  work_experiences: Database["public"]["Tables"]["work_experiences"]["Row"][]
  educations: Database["public"]["Tables"]["educations"]["Row"][]
}

function profileFormValues(application: ApplicationWithProfile) {
  const profile = application.profiles
  const links = Array.isArray(profile.links) ? profile.links as { label: string; url: string }[] : []
  const education = application.educations.map((item) => [
    item.institution,
    [item.degree, item.field_of_study].filter(Boolean).join(" in "),
    [item.start_date, item.end_date].filter(Boolean).join(" – "),
  ].filter(Boolean).join(" | ")).join("\n")
  const employment = application.work_experiences.map((item) => [
    `${item.title} at ${item.company}`,
    [item.start_date, item.is_current ? "Present" : item.end_date].filter(Boolean).join(" – "),
    item.location,
    item.description,
    ...(item.bullets ?? []),
  ].filter(Boolean).join(" | ")).join("\n\n")
  return {
    // Custom answers are for employer-specific questions. They must never
    // override verified profile properties such as the user's name or email.
    ...(profile.custom_fields as Record<string, string> ?? {}),
    full_name: profile.full_name, email: profile.email, phone: profile.phone,
    location: profile.location, summary: profile.summary,
    linkedin: links.find((link) => /linkedin/i.test(link.label))?.url,
    portfolio: links.find((link) => /portfolio|website/i.test(link.label))?.url,
    resume: application.resumes?.storage_path,
    education: education || undefined,
    employment_record: employment || undefined,
  }
}

function mapApplicationFields(fields: RequiredField[], application: ApplicationWithProfile) {
  const { values, missing } = mapRequiredFields(fields, profileFormValues(application))
  const savedAnswers = (application.field_mapping ?? {}) as Record<string, string>
  const resolved = new Set<string>()

  for (const field of missing) {
    const savedValue = savedAnswers[field.key]?.trim()
    const validChoice = !field.options?.length || field.options.some(
      (option) => option.trim().toLocaleLowerCase() === savedValue?.toLocaleLowerCase()
    )
    if (savedValue && validChoice) {
      values[field.key] = savedValue
      resolved.add(field.key)
    }
  }

  return { values, missing: missing.filter((field) => !resolved.has(field.key)) }
}

async function loadApplication(applicationId: string) {
  const admin = createAdminClient()
  const { data: application, error } = await admin
    .from("job_applications")
    .select("*")
    .eq("id", applicationId)
    .single()
  if (error || !application) throw new Error(error?.message ?? "Application not found.")

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("*")
    .eq("id", application.user_id)
    .single()
  if (profileError || !profile) throw new Error(profileError?.message ?? "Profile not found.")

  const [{ data: resume }, { data: workExperiences }, { data: educations }] = await Promise.all([
    profile.active_resume_id
      ? admin.from("resumes").select("*").eq("id", profile.active_resume_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from("work_experiences").select("*").eq("user_id", application.user_id).order("sort_order", { ascending: true }),
    admin.from("educations").select("*").eq("user_id", application.user_id).order("sort_order", { ascending: true }),
  ])

  return {
    admin,
    application: {
      ...application,
      profiles: profile,
      resumes: resume,
      work_experiences: workExperiences ?? [],
      educations: educations ?? [],
    } as ApplicationWithProfile,
  }
}

async function recordWorkflowFailure(
  event: { data: { event: { data?: unknown }; error: { message?: string } } }
) {
  const applicationId = (event.data.event.data as { applicationId?: string } | undefined)?.applicationId
  if (!applicationId) return
  const { error } = await createAdminClient()
    .from("job_applications")
    .update({
      status: "failed",
      pending_action: null,
      error_message: event.data.error.message ?? "The automation workflow failed after retrying.",
    })
    .eq("id", applicationId)
    .neq("status", "submitted")
  if (error) console.error("Could not record job-application workflow failure", error.message)
}

export const detectApplicationFields = inngest.createFunction(
  {
    id: "detect-application-fields",
    concurrency: [{ key: "event.data.userId", limit: 1 }],
    triggers: { event: "application/detect.requested" },
    onFailure: async ({ event }) => recordWorkflowFailure(event),
  },
  async ({ event, step }) => {
    const { admin, application } = await loadApplication(event.data.applicationId)
    try {
      const result = await step.run("inspect application form", () => withBrowserbasePage(async (page, sessionId, stagehand) => {
        // Store the session as soon as it exists so the applicant can watch
        // the live form discovery instead of waiting for the workflow to end.
        await admin.from("job_applications").update({ browserbase_session_id: sessionId }).eq("id", application.id)
        await page.goto(application.application_url, { waitUntil: "domcontentloaded" })
        await openApplicationForm(page, detectApplicationPlatform(application.application_url))
        if (await requiresHumanVerification(page)) {
          await admin.from("job_applications").update({
            browserbase_session_id: sessionId,
            pending_action: "captcha_verification",
            error_message: "Complete verification in the live verification session to continue inspecting this application.",
          }).eq("id", application.id)
          if (!await waitForHumanVerification(page)) {
            throw new Error("Verification session timed out before the application form could be inspected.")
          }
          await page.waitForTimeout(750)
        }
        if (await isApplicationUnavailable(page)) throw new Error("This job listing is no longer available for applications.")
        return { fields: await detectRequiredFields(page, detectApplicationPlatform(application.application_url), stagehand), sessionId }
      }))
      const { values, missing } = mapApplicationFields(result.fields as RequiredField[], application)
      await admin.from("job_applications").update({ platform: detectApplicationPlatform(application.application_url), required_fields: result.fields, missing_fields: missing, field_mapping: values, browserbase_session_id: result.sessionId, status: missing.length ? "missing_profile_info" : "ready_to_apply", pending_action: null, error_message: null }).eq("id", application.id)
    } catch (error) {
      await admin.from("job_applications").update({ status: "failed", pending_action: null, error_message: error instanceof Error ? error.message : "Could not inspect the form." }).eq("id", application.id).neq("status", "submitted")
      throw error
    }
  }
)

export const submitJobApplication = inngest.createFunction(
  {
    id: "submit-job-application",
    // A retry after a partially completed form can create a duplicate
    // application. The user can deliberately start a new attempt instead.
    retries: 0,
    concurrency: [{ key: "event.data.userId", limit: 1 }],
    triggers: { event: "application/submit.requested" },
    onFailure: async ({ event }) => recordWorkflowFailure(event),
  },
  async ({ event, step }) => {
    const { admin, application } = await loadApplication(event.data.applicationId)
    if (application.status !== "ready_to_apply" && application.status !== "submitting") {
      throw new Error(
        `Application is not ready to submit (current status: ${application.status}). Complete and save all required profile details first.`
      )
    }
    if (application.status === "ready_to_apply") {
      await admin.from("job_applications").update({ status: "submitting", pending_action: null, error_message: null }).eq("id", application.id)
    }
    try {
      if (!application.resumes?.storage_path) {
        const resumeField: RequiredField = { key: "resume", label: "Upload your resume/CV", type: "file", required: true }
        await admin.from("job_applications").update({
          status: "missing_profile_info",
          missing_fields: [resumeField],
          pending_action: null,
          error_message: null,
        }).eq("id", application.id)
        return { outcome: "missing_profile_info", missingFields: [resumeField.label] }
      }
      const activeResume = application.resumes
      const downloadedResume = await downloadResumeBuffer(admin, activeResume.storage_path)
      if (!downloadedResume.buffer) throw new Error(`Could not download your active resume: ${downloadedResume.error ?? "file not found"}`)
      const outcome = await step.run("fill and submit", () => withBrowserbasePage(async (page, sessionId, stagehand) => {
        // Make the live Browserbase review link available during form filling.
        await admin.from("job_applications").update({ browserbase_session_id: sessionId }).eq("id", application.id)
        await page.goto(application.application_url, { waitUntil: "domcontentloaded" })
        const platform = detectApplicationPlatform(application.application_url)
        await openApplicationForm(page, platform)
        if (await requiresHumanVerification(page)) {
          await admin.from("job_applications").update({
            browserbase_session_id: sessionId,
            pending_action: "captcha_verification",
            error_message: "Complete verification in the live verification session to continue this application.",
          }).eq("id", application.id)
          if (!await waitForHumanVerification(page)) {
            throw new Error("Verification session timed out before the application could continue.")
          }
          await page.waitForTimeout(750)
        }
        if (await isApplicationUnavailable(page)) throw new Error("This job listing is no longer available for applications.")
        const fields = await detectRequiredFields(page, platform, stagehand)
        const { values, missing } = mapApplicationFields(fields, application)
        if (missing.length) return { sessionId, missing, values: null }
        const submission = await fillAndSubmit(page, values, {
          fileName: activeResume.file_name,
          mimeType: activeResume.mime_type,
          buffer: downloadedResume.buffer,
        }, fields, stagehand, platform)
        if (submission.outcome === "validation_required" || submission.outcome === "manual_review_required") {
          
          await admin.from("job_applications").update({
            browserbase_session_id: sessionId,
            missing_fields: submission.outcome === "validation_required" ? submission.fields : [],
            pending_action: submission.outcome === "validation_required" ? "manual_form_completion" : "manual_submission_review",
            error_message: submission.outcome === "validation_required"
              ? "The AI needs your help with one or more required form fields. Complete them in the live form and press Submit application. The session stays open for two minutes."
              : `The AI clicked Submit, but this employer did not show a verifiable confirmation. Review the completed live form and press the employer's Submit button if it is still shown. The session stays open for two minutes.${submission.diagnostic ? ` Employer response: ${submission.diagnostic}` : ""}`,
          }).eq("id", application.id)
          const manualOutcome = await waitForManualApplicationSubmission(page)
          if (manualOutcome !== "submitted") {
            throw new Error(manualOutcome === "session_expired"
              ? "The live form session expired before the application could be confirmed as submitted. Start a new attempt when you are ready."
              : "The live form session timed out before the application could be confirmed as submitted.")
          }
          return { sessionId, missing: [], values }
        }
        if (submission.outcome === "captcha_required") {
         
          await admin.from("job_applications").update({
            browserbase_session_id: sessionId,
            pending_action: "captcha_verification",
            error_message: "Complete CAPTCHA in the live verification session. The pre-filled browser stays open for two minutes.",
          }).eq("id", application.id)
          const verificationOutcome = await waitForManualVerification(page)
          if (verificationOutcome !== "submitted") {
            throw new Error(verificationOutcome === "session_expired"
              ? "Verification session expired before the application was submitted. Start a new attempt when you are ready to complete CAPTCHA."
              : "Verification session timed out before the application was submitted. Start a new attempt when you are ready to complete CAPTCHA.")
          }
        }
        return { sessionId, missing: [], values }
      }, { keepAlive: true }))
      if (outcome.missing.length) {
        await admin.from("job_applications").update({ status: "missing_profile_info", missing_fields: outcome.missing, field_mapping: { ...(application.field_mapping as Record<string, string>), ...outcome.values }, browserbase_session_id: outcome.sessionId, pending_action: null }).eq("id", application.id)
        return {
          outcome: "missing_profile_info",
          missingFields: (outcome.missing as RequiredField[]).map((field) => field.label),
          browserbaseSessionId: outcome.sessionId,
        }
      }
      await admin.from("job_applications").update({ status: "submitted", submitted_at: new Date().toISOString(), browserbase_session_id: outcome.sessionId, pending_action: null }).eq("id", application.id)
      await admin.from("jobs").update({ applied_status: "applied" }).eq("id", application.job_id)
      return { outcome: "submitted", browserbaseSessionId: outcome.sessionId }
    } catch (error) {
      await admin.from("job_applications").update({ status: "failed", pending_action: null, error_message: error instanceof Error ? error.message : "Submission failed." }).eq("id", application.id).neq("status", "submitted")
      throw error
    }
  }
)


export const reconcileStaleApplications = inngest.createFunction(
  {
    id: "reconcile-stale-job-applications",
    
    triggers: { cron: "*/15 * * * *" },
  },
  async () => {
    const cutoff = new Date(Date.now() - 12 * 60 * 1000).toISOString()
    const { error } = await createAdminClient()
      .from("job_applications")
      .update({
        status: "failed",
        error_message: "The application automation stopped responding and timed out. You can try again.",
      })
      .eq("status", "submitting")
      .lt("updated_at", cutoff)
    if (error) throw new Error(error.message)
    return { reconciledBefore: cutoff }
  }
)
