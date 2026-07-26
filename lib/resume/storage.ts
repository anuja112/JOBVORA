import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

export const RESUME_BUCKET = "resumes"

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
}

export function buildResumeStoragePath(userId: string, fileName: string) {
  return `${userId}/${Date.now()}-${sanitizeFileName(fileName)}`
}

export async function uploadResumeFile(
  supabase: SupabaseClient<Database>,
  params: { userId: string; file: File }
) {
  const { userId, file } = params
  const path = buildResumeStoragePath(userId, file.name)

  const { error } = await supabase.storage
    .from(RESUME_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    return { path: null, error: error.message }
  }

  return { path, error: null }
}

export async function downloadResumeBuffer(
  supabase: SupabaseClient<Database>,
  storagePath: string
) {
  const { data, error } = await supabase.storage
    .from(RESUME_BUCKET)
    .download(storagePath)

  if (error || !data) {
    return { buffer: null, error: error?.message ?? "File not found." }
  }

  const arrayBuffer = await data.arrayBuffer()
  return { buffer: Buffer.from(arrayBuffer), error: null }
}

export async function getResumeSignedUrl(
  supabase: SupabaseClient<Database>,
  storagePath: string,
  expiresInSeconds = 60 * 10
) {
  const { data, error } = await supabase.storage
    .from(RESUME_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error || !data) {
    return null
  }

  return data.signedUrl
}

export async function deleteResumeFile(
  supabase: SupabaseClient<Database>,
  storagePath: string
) {
  const { error } = await supabase.storage
    .from(RESUME_BUCKET)
    .remove([storagePath])

  return { error: error?.message ?? null }
}
