export type RequiredField = { key: string; label: string; type: string; required: boolean; options?: string[] }
export type ProfileValues = Record<string, string | string[] | null | undefined>

const aliases: Record<string, string[]> = {
  full_name: ["name", "full name", "candidate name", "first and last name"],
  email: ["email", "email address"], phone: ["phone", "phone number", "mobile"],
  location: ["location", "current location", "city", "address"], summary: ["cover letter", "summary", "about"],
  resume: ["resume", "cv", "curriculum vitae"],
  linkedin: ["linkedin", "linkedin profile", "linkedin url"], portfolio: ["portfolio", "website", "personal site", "other website"],
}

export function canonicalField(label: string) {
  const normalized = label.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()
  // Core profile fields must match the complete label. Matching a substring
  // made long legal certifications containing the word “name” collide with
  // `full_name`, which silently reused the wrong answer.
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
  for (const field of fields.filter((item) => item.required)) {
    const key = canonicalField(field.label || field.key)
    const raw = profile[key]
    const value = Array.isArray(raw) ? raw.join(", ") : raw
    const normalizedValue = value?.trim().toLocaleLowerCase()
    const hasMatchingOption = !field.options?.length || field.options.some(
      (option) => option.trim().toLocaleLowerCase() === normalizedValue
    )
    // A previous answer must not be reused for a different employer's choices.
    // Return it to the user for review instead of allowing Playwright to wait
    // on an option that can never be selected.
    if (!normalizedValue || !hasMatchingOption) missing.push({ ...field, key })
    else values[field.key] = value?.trim() ?? ""
  }
  return { values, missing }
}
