import type { Locator, Page } from "playwright"
import type { Stagehand } from "@browserbasehq/stagehand"
import { z } from "zod"
import type { RequiredField } from "@/lib/automation/field-mapper"
import type { AutomationPlatform } from "@/lib/automation/platform"

// `CSS.escape()` exists in browsers, not the Node.js process that runs Inngest.
// This escapes identifiers before they are interpolated into Playwright selectors.
function escapeCssIdentifier(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`)
}

type LeverCardQuestion = {
  key: string
  label: string
  required: boolean
  options: string[]
}

export type ResumeAttachment = {
  fileName: string
  mimeType: string
  buffer: Buffer
}

// Lever renders custom questions as `cards[...][fieldN]`, while the actual
// human-facing labels live in the card's hidden `baseTemplate` JSON. Reading
// that metadata is far more accurate than trying to infer a label from nearby
// DOM nodes or asking a vision model to count fields.
async function getLeverCardQuestions(page: Page): Promise<LeverCardQuestion[]> {
  return page.locator('input[name^="cards["][name$="[baseTemplate]"]').evaluateAll((templates) => {
    const questions: LeverCardQuestion[] = []
    for (const template of templates) {
      const name = template.getAttribute("name") ?? ""
      const cardId = name.match(/^cards\[([^\]]+)\]\[baseTemplate\]$/)?.[1]
      if (!cardId) continue
      try {
        const card = JSON.parse((template as HTMLInputElement).value) as {
          fields?: Array<{
            text?: string
            label?: string
            question?: string
            title?: string
            prompt?: string
            description?: string
            required?: boolean
            options?: Array<{ text?: string; label?: string; value?: string } | string>
            choices?: Array<{ text?: string; label?: string; value?: string } | string>
          }>
        }
        for (const [index, field] of (card.fields ?? []).entries()) {
          // The shape differs between Lever card versions. Some forms put the
          // prompt in `label`, `question`, or `title` instead of `text`.
          const label = (field.text || field.label || field.question || field.title || field.prompt || field.description || "").trim()
          if (!label) continue
          const choices = field.options ?? field.choices ?? []
          questions.push({
            key: `cards[${cardId}][field${index}]`,
            label,
            required: Boolean(field.required),
            options: choices.map((option) => typeof option === "string" ? option.trim() : (option.text || option.label || option.value || "").trim()).filter(Boolean),
          })
        }
      } catch {
        // Ignore a malformed card and let the generic scanner handle it.
      }
    }
    return questions
  })
}

export async function openApplicationForm(page: Page, platform: AutomationPlatform) {
  await page.waitForLoadState("domcontentloaded")
  // Cookie banners can cover the application CTA on some job boards.
  await page.getByRole("button", { name: /accept|allow all/i }).first().click({ timeout: 1_500 }).catch(() => undefined)
  const applySelectors: Record<AutomationPlatform, string[]> = {
    lever: ["a.postings-btn", "a:has-text('Apply for this job')", "button:has-text('Apply for this job')"],
    greenhouse: ["#apply_button", "a:has-text('Apply for this job')", "button:has-text('Apply')"],
    workable: ["a:has-text('Apply')", "button:has-text('Apply')"],
    wellfound: ["a:has-text('Apply')", "button:has-text('Apply')"],
    other: ["a:has-text('Apply for this job')", "button:has-text('Apply')"],
  }
  // Skip the CTA when we are already looking at the application form.
  if (await page.locator("input[required], textarea[required], select[required], input[type='file']").count()) return
  for (const selector of applySelectors[platform]) {
    const button = page.locator(selector).first()
    if (await button.count()) {
      await button.click()
      await page.waitForLoadState("domcontentloaded").catch(() => undefined)
      await page.locator("input, textarea, select").first().waitFor({ state: "attached", timeout: 8_000 }).catch(() => undefined)
      // Several independent job boards animate the application modal and add
      // the remaining required controls after the first input is attached.
      await page.waitForTimeout(900)
      return
    }
  }
}

export async function requiresHumanVerification(page: Page) {
  const text = await page.locator("body").innerText().catch(() => "")
  return /verification required|slide right to secure your access|unusual activity|verify you are human|security check/i.test(text)
}

export async function isApplicationUnavailable(page: Page) {
  const text = await page.locator("body").innerText().catch(() => "")
  return /job listing was recently taken down|no longer available for applications|position has been filled|this job is no longer available|sorry,? we (couldn'?t|can'?t) find (anything|that)|page not found|\b404\b/i.test(text)
}

export async function waitForHumanVerification(page: Page, timeoutMs = 240_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!await requiresHumanVerification(page)) return true
    await page.waitForTimeout(2_000)
  }
  return false
}

export async function detectRequiredFields(page: Page, platform: AutomationPlatform, stagehand?: Stagehand): Promise<RequiredField[]> {
  // Deterministic Playwright selectors are used for writes. We intentionally
  // do not use arbitrary parent text as a label: it was causing choices such
  // as “Top secret” to appear as application questions.
  await page.waitForLoadState("domcontentloaded")
  const fields = await page.locator("input, textarea, select").evaluateAll((elements) => elements.map((el) => {
    const input = el as HTMLInputElement
    if (input.type === "hidden" || input.disabled) return null
    const cleanLabel = (value: string) => value
      .replace(/\s+/g, " ")
      .replace(/\s*[✱*].*$/, "")
      .replace(/\s+(?:No .*|Try .*|Loading).*$/i, "")
      .trim()
    // Custom ATS widgets can put the question in a field wrapper instead of a
    // native label. Limit the fallback to prompt-like elements so option text
    // is never mistaken for the question.
    const wrapperQuestion = () => {
      const wrapper = input.closest("[data-question], [data-field], .application-question, .application-field, .form-field, .form-group, .field")
      if (!wrapper) return ""
      const candidates = Array.from(wrapper.querySelectorAll("legend, [data-question], [data-label], [data-qa*='question'], .question-label, .field-label, .application-label, label"))
      for (const candidate of candidates) {
        if (candidate === input || candidate.contains(input)) continue
        const text = cleanLabel(candidate.textContent || "")
        if (text && !/^(select|choose)\.{0,3}$/i.test(text)) return text
      }
      return ""
    }
    const directLabel = input.labels?.[0]?.innerText || (input.id ? document.querySelector(`label[for="${input.id}"]`)?.textContent : "") || input.getAttribute("aria-label")
    // A label on a radio is its *choice*, not the question. Keep it as an
    // option and let the surrounding group/semantic scan provide the prompt.
    let label = input.type === "radio" ? "" : directLabel && !/^(cards\[|select\.\.\.|choose\.\.\.)/i.test(directLabel) ? directLabel.trim() : ""
    if (!label) {
      const labelledBy = input.getAttribute("aria-labelledby")
      label = labelledBy ? labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.innerText).filter(Boolean).join(" ").trim() : ""
    }
    const group = input.closest("fieldset, [role='group']") as HTMLElement | null
    if (!label && group) {
      label = (group.querySelector("legend, [data-question], [aria-label]")?.textContent || group.getAttribute("aria-label") || "").trim()
    }
    if (!label) label = wrapperQuestion()
    // Autocomplete controls often append messages such as “No location found”
    // inside their label. Keep only the human-facing question before the
    // required marker so the profile dialog is understandable.
    label = label.replace(/\s*[✱*].*$/, "").replace(/\s+(?:No .*|Try .*|Loading).*$/i, "").trim()
    const options = input instanceof HTMLSelectElement
      ? Array.from(input.options).map((option) => option.text.trim()).filter((option) => option && !/select|choose/i.test(option))
      : input.type === "radio" && directLabel ? [directLabel.trim()] : []
    return {
      key: input.name || input.id || `field-${Math.random().toString(36).slice(2)}`,
      label,
      type: input.type || input.tagName.toLowerCase(),
      // Some job boards show the required marker visually but omit the native
      // `required` attribute. Treat the label's asterisk as required too.
      required: input.required || input.getAttribute("aria-required") === "true" || /\*/.test(directLabel || label),
      options,
    }
  }).filter(Boolean) as { key: string; label: string; type: string; required: boolean; options: string[] }[])

  // A radio group is one question with several options, not several questions.
  let normalized = Object.values(fields.reduce<Record<string, RequiredField>>((groups, field) => {
    const groupKey = field.type === "radio" ? `radio:${field.key}` : `${field.type}:${field.key}`
    const current = groups[groupKey]
    if (!current) {
      groups[groupKey] = { ...field, label: field.label || "", options: field.options }
    } else {
      current.required ||= field.required
      current.options = [...new Set([...(current.options ?? []), ...field.options])]
    }
    return groups
  }, {})).map((field) => ({
    ...field,
    required: field.required || (platform !== "other" && /resume|email|name/i.test(field.label)),
  }))
  if (platform === "lever") {
    const leverQuestions = new Map((await getLeverCardQuestions(page)).map((question) => [question.key, question]))
    normalized = normalized.map((field) => {
      const question = leverQuestions.get(field.key)
      return question
        ? { ...field, label: question.label, required: question.required, options: question.options.length ? question.options : field.options }
        : field
    })
    // Lever's EEO/disability declaration is voluntary demographic information.
    // It can contain conditionally hidden signature inputs, so it must not be
    // requested from the profile or filled by the application automation.
    normalized = normalized.filter((field) => !field.key.startsWith("eeo["))
    // Keep Lever's baseTemplate labels as the source of truth where available.
    // Do not return yet: some cards omit that metadata, and those blank fields
    // still need the semantic scan below to obtain their actual prompts.
  }
  const requiredFields = normalized.filter((field) => field.required)
  if (!stagehand || !requiredFields.length) return normalized

  try {
    const extracted = await stagehand.extract(
      `Inspect only the visible job application form, not the job description. Return one item for every REQUIRED applicant question that needs an answer. For each item, return the exact native control name or id as \`key\`, the complete human-facing prompt as \`question\`, and all visible choices for radio buttons, checkboxes, and dropdowns. Never return an option, section heading, HTML name, or placeholder as the question. Do not invent questions or choices. The controls that need mapping are: ${JSON.stringify(requiredFields.map((field) => ({ key: field.key, type: field.type, knownQuestion: field.label || undefined })))}`,
      z.object({
        questions: z.array(z.object({ key: z.string(), question: z.string(), options: z.array(z.string()).default([]) })),
      }),
      // The browser session can contain multiple tabs. Explicitly bind the
      // semantic scan to the Playwright page that just navigated to the form.
      { page, serverCache: false, timeout: 60_000 }
    )
    const questions = extracted.questions.filter((item) => item.question.trim())
    const questionsByKey = new Map(questions.map((question) => [question.key, question]))
    requiredFields.forEach((field) => {
      const question = questionsByKey.get(field.key)
      if (!question) return
      if (!field.label.trim()) field.label = question.question
      if (!field.options?.length && question.options.length) field.options = question.options
    })
    // Semantic extraction is more reliable for custom job-board controls. Only
    // assign by visual order when it covers every required control; otherwise
    // preserve known native labels rather than attaching a wrong question.
    if (questions.length >= requiredFields.length) requiredFields.forEach((field, index) => {
      const question = questions[index]
      if (question && !field.label.trim()) {
        field.label = question.question
      }
      if (question && !field.options?.length && question.options.length) field.options = question.options
    })
  } catch {
    // Native labels remain the fallback when the page cannot be semantically read.
  }
  return normalized.map((field, index) => ({
    ...field,
    label: field.label || `Required application question ${index + 1}`,
  }))
}

function hasSubmissionConfirmation(text: string) {
  // Applicant-tracking systems use several confirmation phrasings. Lever in
  // particular can say "Thanks for applying" rather than "submitted".
  return /thank you for (applying|your application)|thanks? for (applying|your application)|application (has been )?submitted|application (has been )?received|we(?:'ve| have) received your application|application complete|successfully (applied|submitted)|your application is complete/i.test(text)
}

async function hasSubmissionSuccess(page: Page) {
  // Lever redirects successful applications to `/thanks`. Checking the URL as
  // well as body text avoids missing a real submission while the new page is
  // still rendering its confirmation copy.
  if (/\/thanks(?:[/?#]|$)/i.test(page.url())) return true
  return hasSubmissionConfirmation(await page.locator("body").innerText().catch(() => ""))
}

const submitCandidates = [
  'button[type="submit"]',
  'input[type="submit"]',
  'button:has-text("Submit application")',
  'button:has-text("Submit")',
  '[data-qa*="submit"]',
]

async function findVisibleSubmitButton(page: Page): Promise<Locator | undefined> {
  for (const selector of submitCandidates) {
    const candidates = page.locator(selector)
    const count = await candidates.count()
    for (let index = 0; index < count; index += 1) {
      const candidate = candidates.nth(index)
      // hCaptcha injects a hidden submit control. Only interact with the
      // actual, visible application button.
      const usable = await candidate.isVisible().catch(() => false)
        && await candidate.isEnabled().catch(() => false)
        && (await candidate.getAttribute("aria-disabled").catch(() => null)) !== "true"
      if (usable) return candidate
    }
  }
  return undefined
}

async function hasCaptchaToken(page: Page) {
  const tokens = page.locator('textarea[name="h-captcha-response"], textarea[name="g-recaptcha-response"], input[name="h-captcha-response"], input[name="g-recaptcha-response"]')
  return (await tokens.evaluateAll((elements) => elements.some((element) => (element as HTMLInputElement).value.trim().length > 0)).catch(() => false))
}

async function hasVisibleCaptchaChallenge(page: Page) {
  const candidates = page.locator('iframe[src*="hcaptcha"], iframe[src*="recaptcha"], .h-captcha, .g-recaptcha, [data-sitekey]')
  return candidates.evaluateAll((elements) => elements.some((element) => {
    const style = window.getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return style.display !== "none"
      && style.visibility !== "hidden"
      && Number(style.opacity || 1) > 0
      && rect.width > 12
      && rect.height > 12
  })).catch(() => false)
}

async function waitForSubmissionConfirmation(page: Page, timeoutMs = 7_500) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await hasSubmissionSuccess(page)) return true
    await page.waitForTimeout(500)
  }
  return false
}

async function getInvalidRequiredFields(page: Page): Promise<RequiredField[]> {
  return page.locator("input, select, textarea").evaluateAll((elements) => elements.flatMap((element, index) => {
    const input = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    if (!input.willValidate || input.disabled || input.validity.valid || input.type === "hidden") return []
    const labelledBy = input.getAttribute("aria-labelledby")
      ?.split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent)
      .filter(Boolean)
      .join(" ")
    const explicitLabel = input.labels?.[0]?.textContent
      || (input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`)?.textContent : "")
    const nearbyLabel = input.closest("label")?.textContent
      || input.parentElement?.querySelector("label")?.textContent
    const label = (labelledBy || explicitLabel || nearbyLabel || input.getAttribute("aria-label") || input.getAttribute("placeholder") || input.name || `Required application question ${index + 1}`)
      .replace(/\s+/g, " ")
      .replace(/\s*[✱*].*$/, "")
      .replace(/\s+(?:No .*|Try .*|Loading).*$/i, "")
      .trim()
    const options = input instanceof HTMLSelectElement
      ? Array.from(input.options).map((option) => option.text.trim()).filter((option) => option && !/select|choose/i.test(option))
      : []
    return [{
      key: input.name || input.id || `invalid-field-${index}`,
      label,
      type: input.type || input.tagName.toLowerCase(),
      required: input.required,
      options,
    }]
  }))
}

type SubmitResult =
  | { outcome: "submitted" }
  | { outcome: "captcha_required" }
  | { outcome: "manual_review_required" }
  | { outcome: "validation_required"; fields: RequiredField[] }

async function selectLocationSuggestion(page: Page, locator: Locator, value: string) {
  // Lever's location control is an autocomplete, not a normal text field.
  // Its results are rendered a little after the input event and do not always
  // use `role=option`, so wait briefly and look for the common list patterns.
  await page.waitForTimeout(900)
  const cityToken = value.split(",")[0]?.trim().toLocaleLowerCase()
  // Lever's location menu in the hosted form is keyboard-navigable even when
  // it does not expose stable option selectors. Choose the first matching
  // result immediately; for "Mumbai, India" this is the visible
  // "Mumbai, Maharashtra, IND" result.
  await locator.press("ArrowDown", { timeout: 2_000 }).catch(() => undefined)
  await locator.press("Enter", { timeout: 2_000 }).catch(() => undefined)
  await page.waitForTimeout(200)
  const expandedAfterKeyboard = await locator.getAttribute("aria-expanded").catch(() => null)
  if (expandedAfterKeyboard !== "true") return true

  const listId = await locator.getAttribute("aria-controls").catch(() => null)
  const options = page.locator([
    '[role="option"]',
    '.pac-item',
    '[data-testid*="location-option" i]',
    '[data-testid*="location-suggestion" i]',
    '.selectize-dropdown .option',
    '.select2-results__option',
    '[class*="autocomplete" i] li',
    '[class*="location" i] [role="listbox"] li',
    listId ? `#${escapeCssIdentifier(listId)} > *` : "",
  ].filter(Boolean).join(", "))
  const count = await options.count()
  let hasVisibleOption = false
  for (let index = 0; index < count; index += 1) {
    const option = options.nth(index)
    const text = await option.innerText().catch(() => "")
    const visible = await option.isVisible().catch(() => false)
    hasVisibleOption ||= visible
    if (visible && (!cityToken || text.toLocaleLowerCase().includes(cityToken))) {
      // Avoid Playwright's click waiting on overlays; native click still
      // reaches the location widget's selection handler.
      await option.evaluate((element) => (element as HTMLElement).click())
      return true
    }
  }
  // Common combobox implementations support this keyboard sequence even when
  // their suggestion rows do not expose a standard role or class name.
  // Several Lever implementations do not expose `aria-expanded`, but do
  // accept this native autocomplete keyboard sequence. Always attempt it as a
  // final fallback; it is harmless on a text-only location control.
  await locator.press("ArrowDown", { timeout: 2_000 }).catch(() => undefined)
  await locator.press("Enter", { timeout: 2_000 }).catch(() => undefined)
  await page.waitForTimeout(250)
  const expanded = await locator.getAttribute("aria-expanded").catch(() => null)
  const activeDescendant = await locator.getAttribute("aria-activedescendant").catch(() => null)
  if (hasVisibleOption || expanded === "true" || activeDescendant) return true
  return false
}

async function locationWasRejected(page: Page) {
  const rejection = page.getByText(/no location found|try entering a different location/i).last()
  return await rejection.isVisible().catch(() => false)
}

export async function waitForManualVerification(page: Page, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  let submittedAfterVerification = false
  while (Date.now() < deadline) {
    if (await hasSubmissionSuccess(page)) return true
    // Browserbase can solve hCaptcha in the running browser. Once it has
    // populated the verification token, the employer form still expects a
    // normal click on its final enabled submit button.
    if (!submittedAfterVerification && await hasCaptchaToken(page)) {
      const submit = await findVisibleSubmitButton(page)
      if (submit) {
        await submit.click()
        submittedAfterVerification = true
        // hCaptcha keeps a polling request open, so `networkidle` can never
        // occur even though the submit click succeeded.
        await page.waitForLoadState("domcontentloaded", { timeout: 5_000 }).catch(() => undefined)
      }
    }
    await page.waitForTimeout(2_000)
  }
  return false
}

// Used when the employer's validation reveals a required control that could
// not be safely completed from the saved profile. Unlike CAPTCHA handling, do
// not click anything here: the applicant reviews the pre-filled form, completes
// the remaining fields, and presses the employer's own final Submit button.
export async function waitForManualApplicationSubmission(page: Page, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await hasSubmissionSuccess(page)) return true
    await page.waitForTimeout(2_000)
  }
  return false
}

export async function fillAndSubmit(page: Page, values: Record<string, string>, resume: ResumeAttachment, fields: RequiredField[], stagehand?: Stagehand, platform?: AutomationPlatform): Promise<SubmitResult> {
  // Upload the CV before any other input. A missing attachment is a hard stop
  // for automatic applications; the workflow must never submit a blank form.
  const resumeField = fields.find((field) => field.type === "file" && /resume|cv|curriculum vitae/i.test(field.label))
  const uploadCandidates = resumeField
    ? [
      page.locator(`[name="${escapeCssIdentifier(resumeField.key)}"], #${escapeCssIdentifier(resumeField.key)}`),
      page.locator('input[type="file"][name*="resume" i], input[type="file"][name*="cv" i], input[type="file"][id*="resume" i], input[type="file"][id*="cv" i]'),
      page.locator('input[type="file"]'),
    ]
    : [
      page.locator('input[type="file"][name*="resume" i], input[type="file"][name*="cv" i], input[type="file"][id*="resume" i], input[type="file"][id*="cv" i]'),
      page.locator('input[type="file"]'),
  ]
  let uploaded = false
  let foundUploadControl = false
  const uploadErrors: string[] = []
  for (const candidates of uploadCandidates) {
    const count = await candidates.count()
    foundUploadControl ||= count > 0
    for (let index = 0; index < count; index += 1) {
      const upload = candidates.nth(index)
      try {
        await upload.setInputFiles({ name: resume.fileName, mimeType: resume.mimeType || "application/pdf", buffer: resume.buffer })
        // Hosted forms commonly replace the input immediately after the
        // `change` event. Inspecting that old locator waits for 30 seconds and
        // produces a false upload failure. A resolved setInputFiles call means
        // the browser received the file and its change event was dispatched.
        uploaded = true
        break
      } catch (error) {
        // Try another file input; some job boards include optional photo files.
        uploadErrors.push(error instanceof Error ? error.message : "The file input rejected the upload.")
      }
    }
    if (uploaded) break
  }
  // Not every platform requests a resume on this screen. When there is no file
  // control at all, continue to fill and validate the actual application
  // fields instead of failing before the form can be inspected. If a file
  // control exists but rejects the file, that remains a hard stop.
  if (foundUploadControl && !uploaded) {
    const detail = uploadErrors.at(-1)
    throw new Error(`Could not attach your resume/CV to this application. ${detail ? `Last upload error: ${detail}` : "No compatible resume upload control was found."}`)
  }

  for (const field of fields) {
    const key = field.key
    const value = values[key]
    if (!value) continue
    const escapedKey = escapeCssIdentifier(key)
    const locator = page.locator(`[name="${escapedKey}"], #${escapedKey}`).first()
    let completed = false
    if (await locator.count()) {
      const elementType = await locator.evaluate((element) => ({ tag: element.tagName.toLowerCase(), type: (element as HTMLInputElement).type }))
      if (elementType.tag === "select") {
        const availableOptions = await locator.locator("option").evaluateAll((options) =>
          options.map((option) => ({
            label: (option.textContent ?? "").trim(),
            value: (option as HTMLOptionElement).value,
          }))
        )
        const selectedOption = availableOptions.find((option) =>
          option.label.toLocaleLowerCase() === value.trim().toLocaleLowerCase() ||
          option.value.toLocaleLowerCase() === value.trim().toLocaleLowerCase()
        )
        if (!selectedOption) {
          throw new Error(`The saved answer \"${value}\" is not an available choice for \"${field.label}\". Please choose one of: ${availableOptions.map((option) => option.label).filter(Boolean).join(", ")}.`)
        }
        // Lever visually replaces the select with a custom combobox and hides
        // the native control. Selecting the native option with force dispatches
        // the required input/change events without waiting for visibility.
        await locator.selectOption({ value: selectedOption.value }, { force: true })
        completed = true
      } else if (elementType.type === "radio") {
      const radios = page.locator(`[name="${escapedKey}"][type="radio"]`)
      const count = await radios.count()
      for (let index = 0; index < count; index += 1) {
        const radio = radios.nth(index)
        const label = await radio.evaluate((element) => (element as HTMLInputElement).labels?.[0]?.innerText || (element as HTMLInputElement).value)
        if (label.trim().toLowerCase() === value.trim().toLowerCase()) {
          // Lever's custom-card radios can be covered by a fixed page layer.
          // Playwright's `check()` still performs a click even with `force`,
          // which can remain pending forever. Set the native state directly
          // and dispatch the same events that Lever listens for.
          await radio.evaluate((element) => {
            const input = element as HTMLInputElement
            if (!input.checked) {
              input.checked = true
              input.dispatchEvent(new Event("input", { bubbles: true }))
              input.dispatchEvent(new Event("change", { bubbles: true }))
            }
          })
          completed = true
          break
        }
      }
      } else if (elementType.type === "checkbox") {
        const shouldCheck = /^(yes|true|1)$/i.test(value)
        await locator.evaluate((element, checked) => {
          const input = element as HTMLInputElement
          if (input.checked !== checked) {
            input.checked = checked
            input.dispatchEvent(new Event("input", { bubbles: true }))
            input.dispatchEvent(new Event("change", { bubbles: true }))
          }
        }, shouldCheck)
        completed = true
      } else if (elementType.type === "file") {
        // File controls cannot be filled with a path string. The dedicated
        // upload block below attaches the signed resume contents instead.
        completed = true
      } else {
        const isLocation = /current location|location|city|address/i.test(field.label)
        if (isLocation && platform === "lever") {
          // Lever only fetches city choices from real keyboard events. `fill()`
          // changes the input value but can skip the key handlers that open the
          // dropdown, leaving a visually-filled yet invalid location.
          await locator.click()
          await locator.press("Control+A")
          await locator.pressSequentially(value, { delay: 45 })
          await selectLocationSuggestion(page, locator, value)
          // Do not continue through the form with a location that the board
          // explicitly rejected. Returning the exact field sends the user to
          // the existing details dialog, where they can provide a valid value.
          if (await locationWasRejected(page)) {
            return { outcome: "validation_required", fields: [field] }
          }
          // Commit Lever's autocomplete value and move focus away from the
          // field. Leaving it focused can keep its async lookup spinner alive.
          await locator.evaluate((input) => (input as HTMLElement).blur()).catch(() => undefined)
        } else {
          await locator.fill(value)
          if (isLocation) await selectLocationSuggestion(page, locator, value)
        }
        completed = true
      }
    }
    // Custom controls do not always expose a usable native selector. Match the
    // Browserbase recommendation: observe once for this exact field, then act
    // on the returned locator instead of guessing from the page text.
    if (!completed && stagehand) {
      const actions = await stagehand.observe(
        `Find the input control for the required question: "${field.label}". Do not submit the form or change any value.`,
        { page, serverCache: false, timeout: 60_000 }
      )
      const action = actions[0]
      if (action) await stagehand.act({ ...action, arguments: [value] }, { page, serverCache: false, timeout: 60_000 })
    }
  }
  const submit = await findVisibleSubmitButton(page)
  if (submit) await submit.click()
  else if (stagehand) await stagehand.act(
    "Click the application form's final Submit button. Do not click any other button.",
    { page, serverCache: false, timeout: 60_000 }
  )
  else throw new Error("Could not find a submit button after opening the application form.")
  // Do not wait for `networkidle`: hCaptcha and analytics requests can poll
  // forever, which made a completed fill appear frozen on the last field.
  await page.waitForLoadState("domcontentloaded", { timeout: 5_000 }).catch(() => undefined)
  // Some ATS submissions take longer than a navigation event to render their
  // confirmation. Give the employer a realistic response window before asking
  // the applicant to review the already-completed form.
  if (!await waitForSubmissionConfirmation(page, 20_000)) {
    const invalidFields = await getInvalidRequiredFields(page)
    if (invalidFields.length) return { outcome: "validation_required", fields: invalidFields }
    if (await hasVisibleCaptchaChallenge(page)) {
      // The form has already been filled and the legitimate submit button was
      // pressed. Return control to the workflow so it can keep this exact
      // Browserbase session open for the applicant to complete CAPTCHA.
      return { outcome: "captcha_required" }
    }
    // Never mark an application as submitted without evidence from the
    // employer. Keep the exact pre-filled session open so the applicant can
    // inspect any site-specific message and press Submit manually if needed.
    return { outcome: "manual_review_required" }
  }
  return { outcome: "submitted" }
}
