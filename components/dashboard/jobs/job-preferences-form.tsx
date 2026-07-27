"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { updateJobPreferencesAction } from "@/app/actions/job-preferences"

const JOB_TYPE_OPTIONS = [
  "",
  "Full-time",
  "Part-time",
  "Contract",
  "Internship",
  "Remote",
  "Hybrid",
]

export function JobPreferencesForm({
  initial,
  onSaved,
}: {
  initial: {
    targetRole: string
    preferredLocation: string
    jobTypePreference: string
  }
  onSaved?: () => void
}) {
  const [values, setValues] = React.useState(initial)
  const [isPending, startTransition] = React.useTransition()
  const [savedAt, setSavedAt] = React.useState<number | null>(null)

  function handleBlurSave() {
    startTransition(async () => {
      const result = await updateJobPreferencesAction({
        targetRole: values.targetRole || null,
        preferredLocation: values.preferredLocation || null,
        jobTypePreference: values.jobTypePreference || null,
      })
      if (result.success) {
        setSavedAt(Date.now())
        onSaved?.()
      }
    })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Target role</Label>
        <Input
          value={values.targetRole}
          onChange={(e) => setValues((v) => ({ ...v, targetRole: e.target.value }))}
          onBlur={handleBlurSave}
          placeholder="Frontend Developer"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          Preferred location
        </Label>
        <Input
          value={values.preferredLocation}
          onChange={(e) =>
            setValues((v) => ({ ...v, preferredLocation: e.target.value }))
          }
          onBlur={handleBlurSave}
          placeholder="Remote, San Francisco…"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Job type</Label>
        <NativeSelect
          className="w-full"
          value={values.jobTypePreference}
          onChange={(e) => {
            const next = { ...values, jobTypePreference: e.target.value }
            setValues(next)
            startTransition(async () => {
              await updateJobPreferencesAction({
                targetRole: next.targetRole || null,
                preferredLocation: next.preferredLocation || null,
                jobTypePreference: next.jobTypePreference || null,
              })
              setSavedAt(Date.now())
              onSaved?.()
            })
          }}
        >
          {JOB_TYPE_OPTIONS.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {option || "Any"}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="col-span-full flex h-4 items-center gap-1.5 text-xs text-muted-foreground">
        {isPending && (
          <>
            <Loader2 className="size-3 animate-spin" /> Saving…
          </>
        )}
        {!isPending && savedAt && <span>Preferences saved.</span>}
      </div>
    </div>
  )
}
