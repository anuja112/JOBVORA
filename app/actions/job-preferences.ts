"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"

const jobPreferencesSchema = z.object({
  targetRole: z.string().trim().max(120).nullable(),
  preferredLocation: z.string().trim().max(120).nullable(),
  jobTypePreference: z.string().trim().max(60).nullable(),
})

export async function updateJobPreferencesAction(
  input: unknown
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "You must be signed in to do this." }
  }

  const parsed = jobPreferencesSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Some fields aren't valid." }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      target_role: parsed.data.targetRole || null,
      preferred_location: parsed.data.preferredLocation || null,
      job_type_preference: parsed.data.jobTypePreference || null,
    })
    .eq("id", user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/dashboard/jobs")
  return { success: true }
}
