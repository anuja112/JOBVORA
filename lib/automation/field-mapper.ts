export type RequiredField = {
  key: string
  label: string
  type: string
  required: boolean
  options?: string[]
  filled?: boolean
  value?: string
  autocomplete?: string

  selector?: string
  source?: "dom" | "semantic" | "fallback"
}
export type ProfileValues = Record<string, string | string[] | null | undefined>

const aliases: Record<string, string[]> = {
  full_name: ["name", "full name", "candidate name", "first and last name"],
  email: ["email", "email address"], phone: ["phone", "phone number", "mobile", "mobile number", "telephone", "telephone number", "tel", "contact number"],
  location: ["location", "current location", "city", "address"], summary: ["cover letter", "summary", "about"],
  resume: ["resume", "cv", "curriculum vitae"],
  linkedin: ["linkedin", "linkedin profile", "linkedin url"], portfolio: ["portfolio", "website", "personal site", "other website"],
}

export function canonicalField(label: string, field?: Pick<RequiredField, "key" | "type" | "autocomplete">) {
  const normalized = label.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()
  const controlHint = `${field?.key ?? ""} ${field?.autocomplete ?? ""}`.toLowerCase()
  if (field?.type === "tel" || /\b(phone|mobile|telephone|tel|contact number)\b/i.test(`${normalized} ${controlHint}`)) return "phone"

  const exactMatch = Object.entries(aliases).find(([, names]) => names.includes(normalized))?.[0]
  if (exactMatch) return exactMatch
  if (/^(resume|cv)( |$)/.test(normalized)) return "resume"
  if (normalized.startsWith("education")) return "education"
  if (normalized.startsWith("employment record")) return "employment_record"
  return normalized.replace(/ /g, "_")
}

export function mapRequiredFields(fields: RequiredField[], profile: ProfileValues) {
  const values: Record<string, string> = {}
  const missing: RequiredField[] = []
  for (const field of fields) {
    if (field.filled) continue
    const key = canonicalField(field.label || field.key, field)
    const raw = profile[key]
    const value = Array.isArray(raw) ? raw.join(", ") : raw
    const normalizedValue = value?.trim().toLocaleLowerCase()
    const hasMatchingOption = !field.options?.length || field.options.some(
      (option) => option.trim().toLocaleLowerCase() === normalizedValue
    )

    if (!normalizedValue || !hasMatchingOption) {
      if (field.required) missing.push({ ...field, key })
    }
    else values[field.key] = value?.trim() ?? ""
  }
  return { values, missing }
}
