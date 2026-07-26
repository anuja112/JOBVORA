"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Attachment,
  AttachmentActions,
  AttachmentAction,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { ResumeUploadZone } from "@/components/dashboard/resume-upload-zone"
import {
  deleteResumeAction,
  getResumeDownloadUrlAction,
} from "@/app/actions/resume"
import type { Database } from "@/lib/supabase/database.types"

type ResumeRow = Database["public"]["Tables"]["resumes"]["Row"]

const STATUS_CONFIG: Record<
  ResumeRow["status"],
  { label: string; icon: React.ReactNode; variant: "secondary" | "outline" | "destructive" }
> = {
  uploaded: {
    label: "Uploaded",
    icon: <Loader2 className="size-3 animate-spin" />,
    variant: "outline",
  },
  processing: {
    label: "Processing",
    icon: <Loader2 className="size-3 animate-spin" />,
    variant: "outline",
  },
  parsed: {
    label: "Parsed",
    icon: <CheckCircle2 className="size-3" />,
    variant: "secondary",
  },
  failed: {
    label: "Failed",
    icon: <AlertCircle className="size-3" />,
    variant: "destructive",
  },
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function ResumeList({ resumes }: { resumes: ResumeRow[] }) {
  const router = useRouter()
  const [uploadKey, setUploadKey] = React.useState(0)
  const [downloadingId, setDownloadingId] = React.useState<string | null>(
    null
  )
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<ResumeRow | null>(
    null
  )

  async function handleDownload(resumeId: string) {
    setDownloadingId(resumeId)
    const result = await getResumeDownloadUrlAction(resumeId)
    setDownloadingId(null)
    if (result.success) {
      window.open(result.data.url, "_blank", "noopener,noreferrer")
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return
    setDeletingId(pendingDelete.id)
    const result = await deleteResumeAction(pendingDelete.id)
    setDeletingId(null)
    setPendingDelete(null)
    if (result.success) {
      router.refresh()
    }
  }

  function handleUploadSuccess() {
    // Remounts the upload zone back to its empty state and refreshes the list.
    setUploadKey((key) => key + 1)
    router.refresh()
  }

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-4xl border bg-card shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
        <div className="flex items-start gap-4 border-b bg-muted/30 px-6 py-5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <UploadCloud className="size-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Upload a new resume</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              PDF or DOCX, up to 10MB. We&apos;ll re-extract your profile
              details with AI and update your Profile page automatically.
            </p>
          </div>
        </div>
        <div className="p-6">
          <ResumeUploadZone key={uploadKey} onSuccess={handleUploadSuccess} />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="px-1 text-sm font-semibold text-muted-foreground">
          Your resumes
        </h2>

        {resumes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed py-16 text-center">
            <FileText className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No resumes uploaded yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {resumes.map((resume) => {
              const status = STATUS_CONFIG[resume.status]
              return (
                <Attachment
                  key={resume.id}
                  orientation="horizontal"
                  className="w-full"
                >
                  <AttachmentMedia>
                    <FileText />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{resume.file_name}</AttachmentTitle>
                    <AttachmentDescription>
                      Uploaded {formatDate(resume.created_at)} ·{" "}
                      {formatBytes(resume.file_size)} · v{resume.version}
                    </AttachmentDescription>
                    {resume.status === "failed" && resume.parse_error && (
                      <p className="mt-1 max-w-full truncate text-xs text-destructive">
                        {resume.parse_error}
                      </p>
                    )}
                  </AttachmentContent>
                  <AttachmentActions>
                    <Badge variant={status.variant} className="gap-1">
                      {status.icon}
                      {status.label}
                    </Badge>
                    <AttachmentAction
                      aria-label="Download resume"
                      disabled={downloadingId === resume.id}
                      onClick={() => handleDownload(resume.id)}
                    >
                      {downloadingId === resume.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Download />
                      )}
                    </AttachmentAction>
                    <AttachmentAction
                      aria-label="Delete resume"
                      disabled={deletingId === resume.id}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setPendingDelete(resume)}
                    >
                      {deletingId === resume.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Trash2 />
                      )}
                    </AttachmentAction>
                  </AttachmentActions>
                </Attachment>
              )
            })}
          </div>
        )}
      </div>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this resume?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `"${pendingDelete.file_name}" will be permanently deleted from storage. Profile details already extracted from it will stay in your profile.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
