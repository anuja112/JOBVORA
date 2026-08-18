"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { inngest } from "@/lib/inngest/client"
import { detectApplicationPlatform } from "@/lib/automation/platform"
import { canonicalField, type RequiredField } from "@/lib/automation/field-mapper"
import { GoogleGenAI } from "@google/genai"
import { checkAndIncrementUsage, usageLimitMessage } from "@/lib/billing/usage"

type Result = { success: true; applicationId: string } | { success: false; error: string }

export async function startAutoApply(jobId: string): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "You must be signed in to apply." }
  const { data: job, error: jobError } = await supabase.from("jobs").select("id, job_url").eq("id", jobId).eq("user_id", user.id).single()
  if (jobError || !job) return { success: false, error: "Job not found." }
  const usage = await checkAndIncrementUsage(supabase, user.id)
  if ("error" in usage) return { success: false, error: `Could not verify your plan usage: ${usage.error}` }
  if (!usage.allowed) return { success: false, error: usageLimitMessage(usage) }
  const { data: application, error } = await supabase.from("job_applications").upsert({ user_id: user.id, job_id: job.id, application_url: job.job_url, platform: detectApplicationPlatform(job.job_url), status: "detecting_fields", pending_action: null, error_message: null }, { onConflict: "user_id,job_id" }).select("id").single()
  if (error || !application) return { success: false, error: error?.message ?? "Could not start the application." }
  await inngest.send({ name: "application/detect.requested", data: { applicationId: application.id, userId: user.id } })
  revalidatePath("/dashboard/status"); revalidatePath("/dashboard/jobs")
  return { success: true, applicationId: application.id }
}

// Manual applications leave this app immediately, so record the applicant's
// intent before opening the external URL. The status survives reloads and is
// visible beside AI-assisted applications in the same status page.
export async function markManualApplicationSubmitted(jobId: string): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "You must be signed in to apply." }
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, job_url")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single()
  if (jobError || !job) return { success: false, error: "Job not found." }

  const [{ error: applicationError }, { error: jobUpdateError }] = await Promise.all([
    supabase.from("job_applications").upsert({
      user_id: user.id,
      job_id: job.id,
      application_url: job.job_url,
      platform: detectApplicationPlatform(job.job_url),
      status: "submitted",
      pending_action: null,
      submitted_at: new Date().toISOString(),
      error_message: null,
    }, { onConflict: "user_id,job_id" }),
    supabase.from("jobs").update({ applied_status: "applied" }).eq("id", job.id).eq("user_id", user.id),
  ])
  if (applicationError || jobUpdateError) return { success: false, error: applicationError?.message ?? jobUpdateError?.message ?? "Could not update the application status." }
  revalidatePath("/dashboard/status"); revalidatePath("/dashboard/jobs"); revalidatePath("/dashboard/saved-jobs")
  return { success: true, applicationId: job.id }
}

export async function continueApplication(applicationId: string): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "You must be signed in." }
  const { data: application, error } = await supabase.from("job_applications").select("id, status").eq("id", applicationId).eq("user_id", user.id).single()
  if (error || !application) return { success: false, error: "Application not found." }
  if (application.status !== "ready_to_apply") return { success: false, error: "Complete the required profile details first." }
  await inngest.send({ name: "application/submit.requested", data: { applicationId, userId: user.id } })
  revalidatePath("/dashboard/status")
  return { success: true, applicationId }
}

export async function refreshApplicationFields(applicationId: string): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "You must be signed in." }
  const { error } = await supabase.from("job_applications").update({ status: "detecting_fields", pending_action: null, error_message: null }).eq("id", applicationId).eq("user_id", user.id)
  if (error) return { success: false, error: error.message }
  await inngest.send({ name: "application/detect.requested", data: { applicationId, userId: user.id } })
  revalidatePath("/dashboard/status")
  return { success: true, applicationId }
}

// Inngest cancellation stops the worker but cannot roll back a database state
// that was already changed to `submitting`. Let the owner explicitly resolve a
// cancelled or stuck run so it does not remain in progress forever.
export async function cancelApplication(applicationId: string): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "You must be signed in." }
  const { error } = await supabase
    .from("job_applications")
    .update({ status: "failed", pending_action: null, error_message: "Automation was cancelled before submission." })
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .eq("status", "submitting")
  if (error) return { success: false, error: error.message }
  revalidatePath("/dashboard/status")
  return { success: true, applicationId }
}

export async function getApplications() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase.from("job_applications").select("*, jobs(title, company, company_logo)").eq("user_id", user.id).order("updated_at", { ascending: false })
  return data ?? []
}

export async function saveMissingApplicationFields(
  applicationId: string,
  values: Record<string, string>
): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "You must be signed in." }
  const { data: application, error } = await supabase
    .from("job_applications")
    .select("id, missing_fields, field_mapping")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .single()
  if (error || !application) return { success: false, error: "Application not found." }

  const missing = (Array.isArray(application.missing_fields) ? application.missing_fields : []) as RequiredField[]
  const validValues = Object.fromEntries(
    missing.map((field) => [field.key, values[field.key]?.trim() ?? ""]).filter(([, value]) => Boolean(value))
  )
  const remaining = missing.filter((field) => !validValues[field.key])
  const { data: profile } = await supabase.from("profiles").select("custom_fields").eq("id", user.id).single()
  const existingCustom = (profile?.custom_fields && typeof profile.custom_fields === "object" && !Array.isArray(profile.custom_fields)
    ? profile.custom_fields : {}) as Record<string, string>
  // Employer account passwords are required by some job boards, but they are
  // application-only credentials and must never be saved into the profile.
  const reusableFields = missing.filter((field) => validValues[field.key] && field.type !== "password" && !/password/i.test(field.label))
  const customFields = { ...existingCustom, ...Object.fromEntries(reusableFields.map((field) => [canonicalField(field.label || field.key), validValues[field.key]])) }
  const { error: profileError } = await supabase.from("profiles").update({ custom_fields: customFields }).eq("id", user.id)
  if (profileError) return { success: false, error: profileError.message }
  const mapping = { ...((application.field_mapping ?? {}) as Record<string, string>), ...validValues }
  const { error: updateError } = await supabase.from("job_applications").update({ field_mapping: mapping, missing_fields: remaining, status: remaining.length ? "missing_profile_info" : "ready_to_apply", pending_action: null }).eq("id", applicationId)
  if (updateError) return { success: false, error: updateError.message }
  revalidatePath("/dashboard/status"); revalidatePath("/dashboard/profile")
  return { success: true, applicationId }
}

export async function autofillMissingApplicationFields(applicationId: string): Promise<{ success: true; values: Record<string, string> } | { success: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "You must be signed in." }
  const [{ data: application }, { data: profile }, { data: workExperiences }, { data: educations }] = await Promise.all([
    supabase.from("job_applications").select("missing_fields").eq("id", applicationId).eq("user_id", user.id).single(),
    supabase.from("profiles").select("full_name, email, phone, location, summary, skills, links, custom_fields").eq("id", user.id).single(),
    supabase.from("work_experiences").select("company, title, location, start_date, end_date, is_current, description, bullets").eq("user_id", user.id).order("sort_order", { ascending: true }),
    supabase.from("educations").select("institution, degree, field_of_study, start_date, end_date, description").eq("user_id", user.id).order("sort_order", { ascending: true }),
  ])
  if (!application || !profile) return { success: false, error: "Application or profile not found." }
  const fields = Array.isArray(application.missing_fields) ? application.missing_fields as RequiredField[] : []
  if (!fields.length) return { success: true, values: {} }
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? process.env.STAGEHAND_MODEL ?? "gemini-2.0-flash",
      contents: `Use only the profile, employment history, and education below to suggest answers for the requested application fields. Return a JSON object whose keys are the exact field keys. Summarize stored education or employment when a field asks for it. Always use an empty string for passwords, account credentials, an unknown home address, professional reference, government-clearance granting agency, work authorization, legal certification, or any other fact not explicitly present. Never invent facts.\n\nFields: ${JSON.stringify(fields.map((field) => ({ key: field.key, label: field.label, type: field.type, options: field.options ?? [] })))}\n\nProfile: ${JSON.stringify(profile)}\n\nWork experience: ${JSON.stringify(workExperiences ?? [])}\n\nEducation: ${JSON.stringify(educations ?? [])}`,
      config: { responseMimeType: "application/json" },
    })
    const parsed = JSON.parse(response.text || "{}") as Record<string, unknown>
    return { success: true, values: Object.fromEntries(fields.map((field) => [field.key, typeof parsed[field.key] === "string" ? parsed[field.key] : ""])) as Record<string, string> }
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || message.includes("quota")) {
      return { success: false, error: "AI autofill is temporarily unavailable because the configured Gemini API key has reached its quota. You can enter the answers manually or try again after your Gemini quota resets." }
    }
    return { success: false, error: "AI autofill could not generate suggestions. Please enter the answers manually." }
  }
}
