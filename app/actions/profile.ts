"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { parsedResumeSchema } from "@/lib/resume/schema"
import { persistResumeData } from "@/lib/resume/persist"

type ActionResult = { success: true } | { success: false; error: string }
type AvatarResult = { success: true; avatarUrl: string } | { success: false; error: string }

const accountSettingsSchema = z.object({
  fullName: z.string().trim().max(255).optional().default(""),
  phone: z.string().trim().max(30).optional().default(""),
})

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

export async function updateAccountSettingsAction(
  input: unknown
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "You must be signed in to do this." }
  }

  const parsed = accountSettingsSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: `Your account settings are invalid: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(", ")}`,
    }
  }

  const fullName = parsed.data.fullName.trim() || null
  const phone = parsed.data.phone.trim() || null

  const { error: authError } = await supabase.auth.updateUser({
    data: { full_name: fullName ?? "" },
  })
  if (authError) {
    return { success: false, error: authError.message }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone,
    })
    .eq("id", user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard/profile")
  revalidatePath("/dashboard", "layout")

  return { success: true }
}

const AVATAR_BUCKET = "avatars"
const MAX_AVATAR_SIZE = 2 * 1024 * 1024
const avatarExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

async function removeStoredAvatars(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  exceptPath?: string
) {
  const { data: files } = await supabase.storage.from(AVATAR_BUCKET).list(userId)
  const paths = (files ?? []).map((file) => `${userId}/${file.name}`).filter((path) => path !== exceptPath)
  if (paths.length) await supabase.storage.from(AVATAR_BUCKET).remove(paths)
}

export async function uploadAvatarAction(formData: FormData): Promise<AvatarResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "You must be signed in to update your photo." }

  const file = formData.get("avatar")
  if (!(file instanceof File) || file.size === 0) return { success: false, error: "Choose an image to upload." }
  if (file.size > MAX_AVATAR_SIZE) return { success: false, error: "Profile photos must be 2MB or smaller." }
  const extension = avatarExtensions[file.type]
  if (!extension) return { success: false, error: "Use a JPG, PNG, or WebP image." }

  const path = `${user.id}/avatar-${Date.now()}.${extension}`
  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) return { success: false, error: `Could not upload your photo: ${uploadError.message}` }

  const { data: publicUrl } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  const avatarUrl = publicUrl.publicUrl
  const { data: previousProfile } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
  const { error: profileError } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id)
  if (profileError) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path])
    return { success: false, error: profileError.message }
  }
  const { error: authError } = await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } })
  if (authError) {
    await supabase.from("profiles").update({ avatar_url: previousProfile?.avatar_url ?? null }).eq("id", user.id)
    await supabase.storage.from(AVATAR_BUCKET).remove([path])
    return { success: false, error: authError.message }
  }

  await removeStoredAvatars(supabase, user.id, path)

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard", "layout")
  return { success: true, avatarUrl }
}

export async function removeAvatarAction(): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "You must be signed in to update your photo." }

  const { data: previousProfile } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
  const { error: profileError } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id)
  if (profileError) return { success: false, error: profileError.message }
  const { error: authError } = await supabase.auth.updateUser({ data: { avatar_url: null } })
  if (authError) {
    await supabase.from("profiles").update({ avatar_url: previousProfile?.avatar_url ?? null }).eq("id", user.id)
    return { success: false, error: authError.message }
  }
  await removeStoredAvatars(supabase, user.id)
  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard", "layout")
  return { success: true }
}
