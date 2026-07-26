"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, FileText, Sparkles, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment"
import {
  parseResumeAction,
  uploadResumeAction,
} from "@/app/actions/resume"
import {
  ACCEPTED_RESUME_EXTENSIONS,
  MAX_RESUME_FILE_SIZE_BYTES,
  SUPPORTED_MIME_TYPES,
} from "@/lib/resume/file-types"

type UploadState = "idle" | "uploading" | "processing" | "error" | "done"

const ACCEPTED_MIME_TYPES: string[] = Object.values(SUPPORTED_MIME_TYPES)
const MAX_FILE_SIZE_BYTES = MAX_RESUME_FILE_SIZE_BYTES

const STATE_COPY: Record<UploadState, { title: string; description: string }> = {
  idle: {
    title: "Choose a resume file",
    description: "PDF or DOCX, up to 10MB",
  },
  uploading: {
    title: "Uploading resume…",
    description: "Saving your file to secure storage",
  },
  processing: {
    title: "Reading your resume with AI…",
    description: "Extracting your profile, skills, and experience",
  },
  error: {
    title: "Something went wrong",
    description: "Fix the issue below and try again",
  },
  done: {
    title: "Resume processed",
    description: "Your profile has been updated",
  },
}

export function ResumeUploadZone({
  onSuccess,
  className,
}: {
  onSuccess?: () => void
  className?: string
}) {
  const inputId = React.useId()
  const [file, setFile] = React.useState<File | null>(null)
  const [state, setState] = React.useState<UploadState>("idle")
  const [error, setError] = React.useState<string | null>(null)

  const isBusy = state === "uploading" || state === "processing"

  function validateAndSetFile(nextFile: File) {
    const lowerName = nextFile.name.toLowerCase()
    const hasValidExtension = ACCEPTED_RESUME_EXTENSIONS.some((ext) =>
      lowerName.endsWith(ext)
    )
    const hasValidMimeType = ACCEPTED_MIME_TYPES.includes(nextFile.type)

    if (!hasValidExtension && !hasValidMimeType) {
      setState("error")
      setError("Please choose a PDF or DOCX file.")
      return
    }

    if (nextFile.size > MAX_FILE_SIZE_BYTES) {
      setState("error")
      setError("File is too large. Please keep it under 10MB.")
      return
    }

    setFile(nextFile)
    setState("idle")
    setError(null)
  }

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0]
    if (nextFile) validateAndSetFile(nextFile)
    event.target.value = ""
  }

  function handleClear() {
    setFile(null)
    setState("idle")
    setError(null)
  }

  async function handleContinue() {
    if (!file) return

    setState("uploading")
    setError(null)

    const formData = new FormData()
    formData.append("file", file)

    const uploadResult = await uploadResumeAction(formData)
    if (!uploadResult.success) {
      setState("error")
      setError(uploadResult.error)
      return
    }

    setState("processing")
    const parseResult = await parseResumeAction(uploadResult.data.resumeId)
    if (!parseResult.success) {
      setState("error")
      setError(parseResult.error)
      return
    }

    setState("done")
    onSuccess?.()
  }

  const copy = STATE_COPY[state]
  const attachmentState: React.ComponentProps<typeof Attachment>["state"] =
    state === "idle" && !file ? "idle" : state === "idle" ? "done" : state

  return (
    <div className={cn("space-y-4", className)}>
      <input
        id={inputId}
        type="file"
        accept={[...ACCEPTED_RESUME_EXTENSIONS, ...ACCEPTED_MIME_TYPES].join(",")}
        className="sr-only"
        disabled={isBusy}
        onChange={handleFileInputChange}
      />

      <Attachment
        state={attachmentState}
        orientation="horizontal"
        className="w-full"
      >
        {!isBusy && state !== "done" && (
          <AttachmentTrigger render={<label htmlFor={inputId} />} />
        )}
        <AttachmentMedia>
          {state === "uploading" || state === "processing" ? (
            <Spinner />
          ) : state === "error" ? (
            <AlertCircle />
          ) : state === "done" ? (
            <CheckCircle2 />
          ) : file ? (
            <FileText />
          ) : (
            <Sparkles />
          )}
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{file ? file.name : copy.title}</AttachmentTitle>
          <AttachmentDescription>
            {state === "idle" && file
              ? `${(file.size / 1024).toFixed(0)} KB · ready to upload`
              : copy.description}
          </AttachmentDescription>
        </AttachmentContent>
        {file && state === "idle" && (
          <AttachmentActions>
            <AttachmentAction onClick={handleClear} aria-label="Remove file">
              <X />
            </AttachmentAction>
          </AttachmentActions>
        )}
      </Attachment>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        onClick={handleContinue}
        disabled={!file || isBusy || state === "done"}
        className="w-full"
      >
        {state === "uploading"
          ? "Uploading…"
          : state === "processing"
            ? "Extracting details…"
            : state === "done"
              ? "Done"
              : "Continue"}
      </Button>
    </div>
  )
}
