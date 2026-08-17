"use client"

import * as React from "react"
import Image from "next/image"
import {
  Bookmark,
  Briefcase,
  Building2,
  ExternalLink,
  Loader2,
  MapPin,
  Wallet,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemHeader,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { getPlatformConfig } from "@/lib/jobs/platforms"
import { stripHtml,withTruncationMark } from "@/lib/jobs/normalize"
import { toggleSaveJobAction } from "@/app/actions/jobs"
import { ApplyOptionsDialog } from "@/components/dashboard/jobs/apply-options-dialog"
import type { Database } from "@/lib/supabase/database.types"

type JobRow = Database["public"]["Tables"]["jobs"]["Row"]
type JobWithAutomation = JobRow & { automationStatus?: string | null }

const automationStatusMeta: Record<string, { label: string; className: string }> = {
  detecting_fields: { label: "Queued", className: "border-blue-500/30 bg-blue-500/10 text-blue-700" },
  ready_to_apply: { label: "Ready to review", className: "border-violet-500/30 bg-violet-500/10 text-violet-700" },
  submitting: { label: "In progress", className: "border-blue-500/30 bg-blue-500/10 text-blue-700" },
  missing_profile_info: { label: "Details needed", className: "border-amber-500/30 bg-amber-500/10 text-amber-700" },
  submitted: { label: "Submitted", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" },
  failed: { label: "Failed", className: "border-destructive/30 bg-destructive/10 text-destructive" },
}

const applicationStatusLabels = {
  not_applied: "Not applied",
  applied: "Applied",
  interviewing: "Interviewing",
  rejected: "Rejected",
  offer: "Offer",
} as const

const applicationStatusClasses = {
  not_applied: "border-muted-foreground/30 text-muted-foreground",
  applied: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  interviewing: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  offer: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
} as const

export function JobListing({
  job,
  onSavedChange,
}: {
  job: JobWithAutomation
  onSavedChange?: (saved: boolean) => void
}) {
  const [saved, setSaved] = React.useState(job.saved_status)
  const [applicationStatus, setApplicationStatus] = React.useState(job.applied_status)
  const [automationStatus, setAutomationStatus] = React.useState(job.automationStatus)
  const [isSaving, setIsSaving] = React.useState(false)
  const [applyOpen, setApplyOpen] = React.useState(false)
  const platform = getPlatformConfig(job.platform)
  const tags = Array.isArray(job.tags) ? (job.tags as string[]) : []

  async function handleToggleSave() {
    const next = !saved
    setSaved(next)
    setIsSaving(true)
    const result = await toggleSaveJobAction(job.id, next)
    setIsSaving(false)
    if (!result.success) {
      setSaved(!next) // revert on failure
      return
    }
    onSavedChange?.(next)
  }

  return (
    <><Item variant="outline" className="flex-col items-start sm:flex-row sm:items-start">
      <ItemMedia variant="image" className="size-12 shrink-0 rounded-2xl bg-muted">
        {job.company_logo ? (
          <Image
            src={job.company_logo}
            alt={job.company ?? "Company logo"}
            width={48}
            height={48}
          />
        ) : (
          <span className="flex size-full items-center justify-center bg-muted">
            <Image src={platform.logo} alt={platform.name} width={28} height={28} />
          </span>
        )}
      </ItemMedia>

      <ItemContent className="min-w-0 flex-1 gap-2.5">
        <ItemHeader>
          <ItemTitle className="w-full min-w-0 truncate text-base font-semibold">
            {stripHtml(job.title)}
          </ItemTitle>
          <Badge variant="outline" className="shrink-0 gap-1.5">
            <Image src={platform.logo} alt="" width={12} height={12} className="rounded-[3px]" />
            {platform.name}
          </Badge>
          <Badge
            variant="outline"
            className={cn("shrink-0", applicationStatusClasses[applicationStatus])}
          >
            {applicationStatusLabels[applicationStatus]}
          </Badge>
          {automationStatus && automationStatusMeta[automationStatus] && (
            <Badge variant="outline" className={cn("shrink-0", automationStatusMeta[automationStatus].className)}>
              {automationStatusMeta[automationStatus].label}
            </Badge>
          )}
        </ItemHeader>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {job.company && (
            <span className="flex items-center gap-1">
              <Building2 className="size-3.5" /> {stripHtml(job.company)}
            </span>
          )}
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" /> {job.location}
            </span>
          )}
          {job.salary && (
            <span className="flex items-center gap-1">
              <Wallet className="size-3.5" /> {job.salary}
            </span>
          )}
          {job.job_type && (
            <span className="flex items-center gap-1">
              <Briefcase className="size-3.5" /> {job.job_type}
            </span>
          )}
          {job.experience_level && <span>· {job.experience_level}</span>}
        </div>

        {job.description && (
          <ItemDescription className="w-full break-words leading-relaxed text-foreground/70 line-clamp-2 sm:line-clamp-1">
            {withTruncationMark(stripHtml(job.description))}
          </ItemDescription>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5 sm:min-w-0 sm:flex-nowrap sm:overflow-x-auto">
            {tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="shrink-0 whitespace-nowrap">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <ItemFooter className="pt-1">
          <div className="flex w-full max-w-40 items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary-foreground"
                style={{ width: `${job.match_score}%` }}
              />
            </div>
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {job.match_score}% match
            </span>
          </div>
        </ItemFooter>
      </ItemContent>

      <ItemActions className="flex-row gap-2 self-start sm:self-center sm:flex-col sm:items-stretch">
        <Button size="sm" onClick={() => setApplyOpen(true)} className="gap-1.5">
          Apply Now <ExternalLink className="size-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isSaving}
          onClick={handleToggleSave}
          className={cn(
            "gap-1.5",
            saved && "border-primary-foreground/30 text-primary-foreground"
          )}
        >
          {isSaving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Bookmark className={cn("size-3.5", saved && "fill-current")} />
          )}
          {saved ? "Saved" : "Save"}
        </Button>
      </ItemActions>
    </Item><ApplyOptionsDialog open={applyOpen} onOpenChange={setApplyOpen} jobId={job.id} jobUrl={job.job_url} onAutoStarted={() => setAutomationStatus("detecting_fields")} onManualSubmitted={() => { setApplicationStatus("applied"); setAutomationStatus("submitted") }} /></>
  )
}
