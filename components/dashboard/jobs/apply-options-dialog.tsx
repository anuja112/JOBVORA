"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Bot, ExternalLink, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { markManualApplicationSubmitted, startAutoApply } from "@/app/actions/applications"

export function ApplyOptionsDialog({ open, onOpenChange, jobId, jobUrl, onAutoStarted, onManualSubmitted }: { open: boolean; onOpenChange: (open: boolean) => void; jobId: string; jobUrl: string; onAutoStarted: () => void; onManualSubmitted: () => void }) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  async function autoApply() {
    setPending(true)
    setError(null)
    try {
      const result = await startAutoApply(jobId)
      if (!result.success) {
        setError(result.error)
        return
      }
      onOpenChange(false)
      onAutoStarted()
      router.push("/dashboard/status")
    } catch {
      setError("Could not start the AI application. Please try again.")
    } finally {
      setPending(false)
    }
  }
  async function manualApply() {
    setPending(true)
    setError(null)
    try {
      const result = await markManualApplicationSubmitted(jobId)
      if (!result.success) {
        setError(result.error)
        return
      }
      window.open(jobUrl, "_blank", "noopener,noreferrer")
      onOpenChange(false)
      onManualSubmitted()
      router.refresh()
    } catch {
      setError("Could not update the application status. Please try again.")
    } finally {
      setPending(false)
    }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>How would you like to apply?</DialogTitle><DialogDescription>Choose a manual application or let the AI agent prepare and submit it using your saved profile.</DialogDescription></DialogHeader><div className="grid gap-3"><Button variant="outline" className="h-auto justify-start gap-3 p-4" onClick={manualApply} disabled={pending}><ExternalLink className="size-5"/><span className="text-left"><span className="block font-semibold">Apply manually</span><span className="block text-xs font-normal text-muted-foreground">Open the application in a new tab.</span></span></Button><Button className="h-auto justify-start gap-3 p-4" onClick={autoApply} disabled={pending}><>{pending ? <Loader2 className="size-5 animate-spin"/> : <Bot className="size-5"/>}</><span className="text-left"><span className="block font-semibold">Apply automatically using AI Agent</span><span className="block text-xs font-normal text-primary-foreground/75">Detect fields, check your profile, then submit.</span></span></Button></div>{error && <p className="text-sm text-destructive">{error}</p>}</DialogContent></Dialog>
}
