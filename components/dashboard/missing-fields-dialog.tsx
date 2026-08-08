"use client"

import * as React from "react"
import { Bot, Loader2, Sparkles } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { autofillMissingApplicationFields, saveMissingApplicationFields } from "@/app/actions/applications"

type Field = { key: string; label: string; type?: string; options?: string[] }

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
  async function autofill() { setFilling(true); setError(null); const result = await autofillMissingApplicationFields(applicationId); setFilling(false); if (!result.success) return setError(result.error); setValues((current) => ({ ...current, ...result.values })) }
  async function save() { setSaving(true); setError(null); const result = await saveMissingApplicationFields(applicationId, values); setSaving(false); if (!result.success) return setError(result.error); onOpenChange(false); onSaved() }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Complete application details</DialogTitle><DialogDescription>Select an answer where choices are provided. AI can suggest answers from your saved profile and resume; review every suggestion before saving.</DialogDescription></DialogHeader><div className="sticky top-0 z-10 -mx-6 border-y bg-popover/95 px-6 py-3 backdrop-blur"><Button variant="outline" size="sm" onClick={autofill} disabled={filling}>{filling ? <Loader2 className="animate-spin" /> : <Sparkles />} Fill from profile and resume</Button></div><div className="space-y-5">{fields.map((field, index) => <div key={`${field.key}-${index}`} className="rounded-2xl border bg-muted/20 p-4"><Label htmlFor={`${applicationId}-${field.key}-${index}`} className="text-sm font-semibold">{displayLabel(field, index)}</Label>{field.type === "password" && <p className="mt-1 text-xs text-muted-foreground">Used only for this employer account and never saved to your profile.</p>}{field.options?.length ? <select id={`${applicationId}-${field.key}-${index}`} className="mt-3 h-10 w-full rounded-xl border bg-background px-3 text-sm" value={values[field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}><option value="">Select an answer</option>{field.options.map((option, optionIndex) => <option key={`${option}-${optionIndex}`} value={option}>{option}</option>)}</select> : needsLongAnswer(field) ? <textarea id={`${applicationId}-${field.key}-${index}`} className="mt-3 min-h-28 w-full rounded-xl border bg-background p-3 text-sm" value={values[field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} /> : <Input className="mt-3" id={`${applicationId}-${field.key}-${index}`} type={field.type === "email" ? "email" : field.type === "password" ? "password" : "text"} value={values[field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} />}</div>)}</div>{error && <p className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2 border-t pt-4"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Bot />} Save and continue</Button></div></DialogContent></Dialog>
}
