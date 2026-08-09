"use client"

import * as React from "react"
import { Bot, Loader2, Sparkles } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { autofillMissingApplicationFields, saveMissingApplicationFields } from "@/app/actions/applications"

type Field = { key: string; label: string; type?: string; options?: string[] }

const isPlaceholderOption = (option: string) => /^(select|choose|please select)(?:\s+an\s+answer)?\.{0,3}$/i.test(option.trim())

function displayLabel(field: Field, index: number) {
  return !field.label || /^cards\[/i.test(field.label) || field.label === "Additional application detail"
    ? `Application detail ${index + 1}`
    : field.label
}

function needsLongAnswer(field: Field) {
  return field.type === "textarea" || /address|clearance|education|employment|reference|describe|experience/i.test(field.label)
}

export function MissingFieldsDialog({ applicationId, fields, open, onOpenChange, onSaved }: { applicationId: string; fields: Field[]; open: boolean; onOpenChange: (value: boolean) => void; onSaved: () => void }) {
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)
  const [filling, setFilling] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const incompleteKeys = new Set(fields.filter((field) => !(values[field.key] ?? "").trim()).map((field) => field.key))
  const isComplete = incompleteKeys.size === 0

  async function autofill() {
    setFilling(true)
    setError(null)
    try {
      const result = await autofillMissingApplicationFields(applicationId)
      if (!result.success) {
        setError(result.error)
        return
      }
      setValues((current) => ({ ...current, ...result.values }))
    } catch {
      setError("Could not suggest answers right now. Please enter them manually.")
    } finally {
      setFilling(false)
    }
  }

  async function save() {
    if (!isComplete) {
      setError("Complete every required application detail before continuing.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const result = await saveMissingApplicationFields(applicationId, values)
      if (!result.success) {
        setError(result.error)
        return
      }
      onOpenChange(false)
      onSaved()
    } catch {
      setError("Could not save your application details. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Complete application details</DialogTitle><DialogDescription>Select an answer where choices are provided. AI can suggest answers from your saved profile and resume; review every suggestion before saving.</DialogDescription></DialogHeader><div className="sticky top-0 z-10 -mx-6 border-y bg-popover/95 px-6 py-3 backdrop-blur"><Button variant="outline" size="sm" onClick={autofill} disabled={filling || saving}>{filling ? <Loader2 className="animate-spin" /> : <Sparkles />} Fill from profile and resume</Button></div><div className="space-y-5">{fields.map((field, index) => { const incomplete = incompleteKeys.has(field.key); const id = `${applicationId}-${field.key}-${index}`; const options = (field.options ?? []).filter((option) => option.trim() && !isPlaceholderOption(option)); return <div key={`${field.key}-${index}`} className={`rounded-2xl border bg-muted/20 p-4 ${incomplete ? "border-destructive/60" : ""}`}><div className="flex items-start justify-between gap-3"><Label htmlFor={id} className="text-sm font-semibold">{displayLabel(field, index)}</Label>{incomplete && <span className="text-xs font-medium text-destructive">Required</span>}</div>{field.type === "password" && <p className="mt-1 text-xs text-muted-foreground">Used only for this employer account and never saved to your profile.</p>}{options.length ? <select id={id} aria-invalid={incomplete} className="mt-3 h-10 w-full rounded-xl border bg-background px-3 text-sm" value={values[field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}>{options.map((option, optionIndex) => <option key={`${option}-${optionIndex}`} value={option}>{option}</option>)}</select> : needsLongAnswer(field) ? <textarea id={id} aria-invalid={incomplete} className="mt-3 min-h-28 w-full rounded-xl border bg-background p-3 text-sm" value={values[field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} /> : <Input className="mt-3" id={id} aria-invalid={incomplete} type={field.type === "email" ? "email" : field.type === "password" ? "password" : field.type === "tel" ? "tel" : "text"} value={values[field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} />}</div> })}</div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2 border-t pt-4"><Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button><Button onClick={save} disabled={saving || !isComplete}>{saving ? <Loader2 className="animate-spin" /> : <Bot />} Save and continue</Button></div></DialogContent></Dialog>
}
