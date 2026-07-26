export const SUPPORTED_MIME_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const

export const ACCEPTED_RESUME_EXTENSIONS = [".pdf", ".docx"] as const

export const MAX_RESUME_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

export type ResumeFileKind = keyof typeof SUPPORTED_MIME_TYPES

export function getResumeFileKind(
  fileName: string,
  mimeType: string
): ResumeFileKind | null {
  const lowerName = fileName.toLowerCase()
  if (mimeType === SUPPORTED_MIME_TYPES.pdf || lowerName.endsWith(".pdf")) {
    return "pdf"
  }
  if (mimeType === SUPPORTED_MIME_TYPES.docx || lowerName.endsWith(".docx")) {
    return "docx"
  }
  return null
}
