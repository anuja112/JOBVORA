"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { FileCheck2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ResumeUploadZone } from "@/components/dashboard/resume-upload-zone"

export function OnboardingDialog({ open }: { open: boolean }) {
  const router = useRouter()
  const [justFinished, setJustFinished] = React.useState(false)

  function handleSuccess() {
    setJustFinished(true)
    // Re-fetch the layout's server data (profiles.onboarding_completed),
    // which flips `open` to false and unmounts this dialog.
    router.refresh()
  }

  return (
    <Dialog
      open={open}
      // Fully controlled + no-op handler: ignores escape key and outside
      // clicks, so the only way out is a successful upload.
      onOpenChange={() => {}}
      disablePointerDismissal
    >
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <FileCheck2 className="size-5" />
          </div>
          <DialogTitle className="text-lg">
            Upload your resume to continue
          </DialogTitle>
          <DialogDescription>
            Jobvora needs your resume to build your profile and start
            matching you with roles. This only takes a moment — upload a PDF
            or DOCX to unlock your dashboard.
          </DialogDescription>
        </DialogHeader>

        <ResumeUploadZone onSuccess={handleSuccess} />

        {justFinished && (
          <p className="text-center text-xs text-muted-foreground">
            All set — loading your dashboard…
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
