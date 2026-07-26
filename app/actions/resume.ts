"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import {
  buildResumeStoragePath,
  deleteResumeFile,
  downloadResumeBuffer,
  getResumeSignedUrl,
  RESUME_BUCKET,
} from "@/lib/resume/storage"
import { getResumeFileKind, MAX_RESUME_FILE_SIZE_BYTES } from "@/lib/resume/file-types"
import { parseResumeWithGemini } from "@/lib/resume/gemini"
import { persistResumeData } from "@/lib/resume/persist"

type ActionResult<T = undefined> =
  | ({ success: true } & (T extends undefined ? object : { data: T }))
  | { success: false; error: string }

/**
 * Step 1: validate + upload the resume file to Supabase Storage and create
 * the `resumes` row. Returns the new resume's id so the client can then
 * call `parseResumeAction` to kick off Gemini parsing.
 */
export async function uploadResumeAction(
  formData: FormData
): Promise<ActionResult<{ resumeId: string }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "You must be signed in to upload a resume." }
  }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "No resume file was provided." }
  }

  if (file.size > MAX_RESUME_FILE_SIZE_BYTES) {
    return { success: false, error: "Resume must be smaller than 10MB." }
  }

  const kind = getResumeFileKind(file.name, file.type)
  if (!kind) {
    return {
      success: false,
      error: "Unsupported file type. Please upload a PDF or DOCX resume.",
    }
  }

  const storagePath = buildResumeStoragePath(user.id, file.name)
  const { error: uploadError } = await supabase.storage
    .from(RESUME_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return { success: false, error: `Upload failed: ${uploadError.message}` }
  }

  const { count: existingResumeCount } = await supabase
    .from("resumes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)

  const { data: resume, error: insertError } = await supabase
    .from("resumes")
    .insert({
      user_id: user.id,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      file_size: file.size,
      status: "uploaded",
      version: (existingResumeCount ?? 0) + 1,
    })
    .select("id")
    .single()

  if (insertError || !resume) {
    return {
      success: false,
      error: `Failed to save resume record: ${insertError?.message ?? "unknown error"}`,
    }
  }

  revalidatePath("/dashboard/resume")

  return { success: true, data: { resumeId: resume.id } }
}

/**
 * Step 2: download the uploaded file back from Storage, parse it with
 * Gemini, and write the extracted data into profiles + child tables.
 */
export async function parseResumeAction(
  resumeId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "You must be signed in to do this." }
  }

  const { data: resume, error: resumeError } = await supabase
    .from("resumes")
    .select("*")
    .eq("id", resumeId)
    .eq("user_id", user.id)
    .single()

  if (resumeError || !resume) {
    return { success: false, error: "Resume not found." }
  }

  await supabase
    .from("resumes")
    .update({ status: "processing" })
    .eq("id", resumeId)

  const { buffer, error: downloadError } = await downloadResumeBuffer(
    supabase,
    resume.storage_path
  )

  if (downloadError || !buffer) {
    await supabase
      .from("resumes")
      .update({ status: "failed", parse_error: downloadError })
      .eq("id", resumeId)
    return { success: false, error: downloadError ?? "Could not read the uploaded file." }
  }

  const result = await parseResumeWithGemini({
    buffer,
    fileName: resume.file_name,
    mimeType: resume.mime_type,
  })

  if (!result.success) {
    await supabase
      .from("resumes")
      .update({ status: "failed", parse_error: result.error })
      .eq("id", resumeId)
    return { success: false, error: result.error }
  }

  const { error: persistError } = await persistResumeData(supabase, {
    userId: user.id,
    resumeId,
    data: result.data,
    markOnboardingComplete: true,
  })

  if (persistError) {
    await supabase
      .from("resumes")
      .update({ status: "failed", parse_error: persistError })
      .eq("id", resumeId)
    return { success: false, error: persistError }
  }

  await supabase
    .from("resumes")
    .update({ status: "parsed", parse_error: null })
    .eq("id", resumeId)

  revalidatePath("/dashboard", "layout")

  return { success: true }
}

export async function getResumeDownloadUrlAction(
  resumeId: string
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "You must be signed in to do this." }
  }

  const { data: resume, error } = await supabase
    .from("resumes")
    .select("storage_path")
    .eq("id", resumeId)
    .eq("user_id", user.id)
    .single()

  if (error || !resume) {
    return { success: false, error: "Resume not found." }
  }

  const url = await getResumeSignedUrl(supabase, resume.storage_path)
  if (!url) {
    return { success: false, error: "Could not generate a download link." }
  }

  return { success: true, data: { url } }
}

/**
 * Deletes a resume: removes the file from Storage, deletes the `resumes`
 * row, and clears `profiles.active_resume_id` if it pointed at this resume.
 * Previously-extracted profile data (skills, work experience, etc.) is left
 * in place — deleting a resume doesn't undo what was learned from it.
 */
export async function deleteResumeAction(
  resumeId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "You must be signed in to do this." }
  }

  const { data: resume, error: fetchError } = await supabase
    .from("resumes")
    .select("storage_path")
    .eq("id", resumeId)
    .eq("user_id", user.id)
    .single()

  if (fetchError || !resume) {
    return { success: false, error: "Resume not found." }
  }

  const { error: storageError } = await deleteResumeFile(
    supabase,
    resume.storage_path
  )
  if (storageError) {
    return { success: false, error: `Failed to delete file: ${storageError}` }
  }

  const { error: deleteError } = await supabase
    .from("resumes")
    .delete()
    .eq("id", resumeId)
    .eq("user_id", user.id)

  if (deleteError) {
    return { success: false, error: deleteError.message }
  }

  await supabase
    .from("profiles")
    .update({ active_resume_id: null })
    .eq("id", user.id)
    .eq("active_resume_id", resumeId)

  revalidatePath("/dashboard/resume")

  return { success: true }
}
