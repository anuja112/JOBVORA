"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { parsedResumeSchema } from "@/lib/resume/schema"
import { persistResumeData } from "@/lib/resume/persist"

type ActionResult = { success: true } | { success: false; error: string }

/**
 * Saves the full Profile page form. Reuses the same shape as the Gemini
 * resume parser (`parsedResumeSchema`) since the form edits the same data —
 * it's just a human doing the "extraction" this time instead of Gemini.
 */
export async function updateProfileAction(
  input: unknown
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "You must be signed in to do this." }
  }

  const parsed = parsedResumeSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: `Some fields aren't valid: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(", ")}`,
    }
  }

  const { error } = await persistResumeData(supabase, {
    userId: user.id,
    resumeId: null,
    data: parsed.data,
  })

  if (error) {
    return { success: false, error }
  }

  revalidatePath("/dashboard/profile")
  revalidatePath("/dashboard/jobs")
  revalidatePath("/dashboard/saved-jobs")

  return { success: true }
}
