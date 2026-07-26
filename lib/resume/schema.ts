import { z } from "zod"

/**
 * Shape of the structured data we ask Gemini to extract from a resume.
 * Keep this in sync with `RESUME_RESPONSE_SCHEMA` in gemini.ts (the JSON
 * schema we hand to the model) — this Zod schema is what we validate the
 * model's JSON response against before writing anything to the database.
 */
export const parsedResumeSchema = z.object({
  fullName: z.string().trim().nullable().default(null),
  headline: z.string().trim().nullable().default(null),
  email: z.string().trim().nullable().default(null),
  phone: z.string().trim().nullable().default(null),
  location: z.string().trim().nullable().default(null),
  summary: z.string().trim().nullable().default(null),
  skills: z.array(z.string().trim()).default([]),
  links: z
    .array(
      z.object({
        label: z.string().trim(),
        url: z.string().trim(),
      })
    )
    .default([]),
  workExperience: z
    .array(
      z.object({
        company: z.string().trim(),
        title: z.string().trim(),
        location: z.string().trim().nullable().default(null),
        startDate: z.string().trim().nullable().default(null),
        endDate: z.string().trim().nullable().default(null),
        isCurrent: z.boolean().default(false),
        description: z.string().trim().nullable().default(null),
        bullets: z.array(z.string().trim()).default([]),
      })
    )
    .default([]),
  education: z
    .array(
      z.object({
        institution: z.string().trim(),
        degree: z.string().trim().nullable().default(null),
        fieldOfStudy: z.string().trim().nullable().default(null),
        startDate: z.string().trim().nullable().default(null),
        endDate: z.string().trim().nullable().default(null),
        description: z.string().trim().nullable().default(null),
      })
    )
    .default([]),
  projects: z
    .array(
      z.object({
        name: z.string().trim(),
        description: z.string().trim().nullable().default(null),
        techStack: z.array(z.string().trim()).default([]),
        link: z.string().trim().nullable().default(null),
      })
    )
    .default([]),
  certifications: z
    .array(
      z.object({
        name: z.string().trim(),
        issuer: z.string().trim().nullable().default(null),
        issueDate: z.string().trim().nullable().default(null),
        credentialUrl: z.string().trim().nullable().default(null),
      })
    )
    .default([]),
})

export type ParsedResume = z.infer<typeof parsedResumeSchema>

export const emptyParsedResume: ParsedResume = {
  fullName: null,
  headline: null,
  email: null,
  phone: null,
  location: null,
  summary: null,
  skills: [],
  links: [],
  workExperience: [],
  education: [],
  projects: [],
  certifications: [],
}
