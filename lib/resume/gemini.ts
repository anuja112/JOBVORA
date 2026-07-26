import { GoogleGenAI } from "@google/genai"
import mammoth from "mammoth"

import { parsedResumeSchema, type ParsedResume } from "@/lib/resume/schema"
import {
  getResumeFileKind,
  SUPPORTED_MIME_TYPES,
} from "@/lib/resume/file-types"

const GEMINI_MODEL = "gemini-3.1-flash-lite"

// Keep in sync with `parsedResumeSchema` in ./schema.ts
const RESUME_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    fullName: { type: "string", nullable: true },
    headline: { type: "string", nullable: true },
    email: { type: "string", nullable: true },
    phone: { type: "string", nullable: true },
    location: { type: "string", nullable: true },
    summary: { type: "string", nullable: true },
    skills: { type: "array", items: { type: "string" } },
    links: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          url: { type: "string" },
        },
        required: ["label", "url"],
      },
    },
    workExperience: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          title: { type: "string" },
          location: { type: "string", nullable: true },
          startDate: { type: "string", nullable: true },
          endDate: { type: "string", nullable: true },
          isCurrent: { type: "boolean" },
          description: { type: "string", nullable: true },
          bullets: { type: "array", items: { type: "string" } },
        },
        required: ["company", "title"],
      },
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          institution: { type: "string" },
          degree: { type: "string", nullable: true },
          fieldOfStudy: { type: "string", nullable: true },
          startDate: { type: "string", nullable: true },
          endDate: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
        },
        required: ["institution"],
      },
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string", nullable: true },
          techStack: { type: "array", items: { type: "string" } },
          link: { type: "string", nullable: true },
        },
        required: ["name"],
      },
    },
    certifications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          issuer: { type: "string", nullable: true },
          issueDate: { type: "string", nullable: true },
          credentialUrl: { type: "string", nullable: true },
        },
        required: ["name"],
      },
    },
  },
  required: ["skills", "links", "workExperience", "education", "projects", "certifications"],
} as const

const EXTRACTION_PROMPT = `You are a resume parser. Read the attached resume and extract every relevant detail into the JSON schema you were given.

Rules:
- Only use information present in the resume. Never invent or guess data.
- If a field isn't present in the resume, use null (or an empty array for list fields).
- "skills" should be a flat, deduplicated list of individual skills/technologies, not sentences.
- "workExperience" and "education" should be ordered most recent first.
- Preserve bullet points from each job as separate strings in "bullets" (no leading dashes/bullets characters).
- "isCurrent" should be true only if the role explicitly says "Present", "Current", or similar.
- Extract links (LinkedIn, GitHub, portfolio, personal website, etc.) into "links" with a short human-readable "label".
- Return ONLY the JSON object — no commentary, no markdown code fences.`

let cachedClient: GoogleGenAI | null = null

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to your .env.local file."
    )
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey })
  }
  return cachedClient
}

type ParseResumeResult =
  | { success: true; data: ParsedResume }
  | { success: false; error: string }

/**
 * Parses a resume file (PDF or DOCX) with Gemini and returns validated,
 * structured data. PDFs are sent to Gemini natively as multimodal input;
 * DOCX files are converted to plain text first (Gemini doesn't accept
 * Office documents as inline file data) and sent as text.
 */
export async function parseResumeWithGemini(params: {
  buffer: Buffer
  fileName: string
  mimeType: string
}): Promise<ParseResumeResult> {
  const { buffer, fileName, mimeType } = params
  const kind = getResumeFileKind(fileName, mimeType)

  if (!kind) {
    return {
      success: false,
      error: "Unsupported file type. Please upload a PDF or DOCX resume.",
    }
  }

  try {
    const ai = getGeminiClient()

    const parts: Array<
      { text: string } | { inlineData: { mimeType: string; data: string } }
    > = [{ text: EXTRACTION_PROMPT }]

    if (kind === "pdf") {
      parts.push({
        inlineData: {
          mimeType: SUPPORTED_MIME_TYPES.pdf,
          data: buffer.toString("base64"),
        },
      })
    } else {
      const { value: text } = await mammoth.extractRawText({ buffer })
      if (!text.trim()) {
        return {
          success: false,
          error: "Couldn't read any text from this DOCX file.",
        }
      }
      parts.push({ text: `Resume text:\n\n${text}` })
    }

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: RESUME_RESPONSE_SCHEMA,
      },
    })

    const rawText = response.text
    if (!rawText) {
      return { success: false, error: "Gemini returned an empty response." }
    }

    let json: unknown
    try {
      json = JSON.parse(rawText)
    } catch {
      return {
        success: false,
        error: "Gemini returned a response that wasn't valid JSON.",
      }
    }

    const parsed = parsedResumeSchema.safeParse(json)
    if (!parsed.success) {
      return {
        success: false,
        error: `Extracted resume data didn't match the expected shape: ${parsed.error.message}`,
      }
    }

    return { success: true, data: parsed.data }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unexpected error while parsing the resume with Gemini.",
    }
  }
}
