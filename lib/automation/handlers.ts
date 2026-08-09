import type { Locator, Page } from "playwright"
import type { Stagehand } from "@browserbasehq/stagehand"
import { z } from "zod"
import type { RequiredField } from "@/lib/automation/field-mapper"
import type { AutomationPlatform } from "@/lib/automation/platform"


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
  if (await page.locator("input[required], textarea[required], select[required], input[type='file'], [aria-required='true'], [role='combobox'], [aria-haspopup='listbox']").count()) return
  for (const selector of applySelectors[platform]) {
    const button = page.locator(selector).first()
    if (await button.count()) {
      await button.click()
      await page.waitForLoadState("domcontentloaded").catch(() => undefined)
      await page.locator("input, textarea, select").first().waitFor({ state: "attached", timeout: 8_000 }).catch(() => undefined)

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
    if (page.isClosed()) return false
    try {
      if (!await requiresHumanVerification(page)) return true
      await page.waitForTimeout(2_000)
    } catch {
      return false
    }
  }
  return false
}

async function revealLazyApplicationFields(page: Page) {

  await page.evaluate(async () => {
    const container = document.querySelector("form, [role='form'], main") as HTMLElement | null
    const target = container && container.scrollHeight > container.clientHeight ? container : document.scrollingElement as HTMLElement | null
    if (!target) return
    const initial = target.scrollTop
    for (let top = 0; top < target.scrollHeight; top += Math.max(320, target.clientHeight || 600)) {
      target.scrollTop = top
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }
    target.scrollTop = initial
  }).catch(() => undefined)
}

async function discoverCustomDropdownOptions(page: Page, fields: RequiredField[]) {
  for (const field of fields) {
    if (field.options?.length || !/combobox|select|listbox/i.test(field.type)) continue
    const key = escapeCssIdentifier(field.key)
    const control = field.selector ? page.locator(field.selector).first() : page.locator(`[name="${key}"], #${key}, [data-field="${key}"], [data-testid="${key}"], [data-qa="${key}"]`).first()
    if (!await control.count()) continue
    const opened = (await control.getAttribute("aria-expanded").catch(() => null)) !== "true"
    if (opened) await control.click({ timeout: 2_000 }).catch(() => undefined)
    const listId = await control.getAttribute("aria-controls").catch(() => null)
    const optionSelector = [
      listId ? `#${escapeCssIdentifier(listId)} [role='option'], #${escapeCssIdentifier(listId)} option, #${escapeCssIdentifier(listId)} li` : "",
      "[role='listbox']:visible [role='option']",
      "[role='listbox']:visible option",
      "[role='listbox']:visible li",
    ].filter(Boolean).join(", ")
    const options = await page.locator(optionSelector).allTextContents().catch(() => [])
    field.options = [...new Set(options.map((option) => option.replace(/\s+/g, " ").trim()).filter((option) => option && !/^(select|choose|please select)(?:\s+an\s+answer)?\.{0,3}$/i.test(option)))]
    if (opened) await page.keyboard.press("Escape").catch(() => undefined)
  }
}

export async function detectRequiredFields(page: Page, platform: AutomationPlatform, stagehand?: Stagehand): Promise<RequiredField[]> {
  console.info("[FORM SCAN] Starting scan")

  await page.waitForLoadState("domcontentloaded")
  await revealLazyApplicationFields(page)
  const nativeFields = await page.locator("input, textarea, select").evaluateAll((elements) => elements.map((el) => {
    const input = el as HTMLInputElement
    if (input.type === "hidden" || input.disabled) return null
    const cleanLabel = (value: string) => value
      .replace(/\s+/g, " ")
      .replace(/\s*[✱*].*$/, "")
      .replace(/\s+(?:No .*|Try .*|Loading).*$/i, "")
      .trim()

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

    label = label.replace(/\s*[✱*].*$/, "").replace(/\s+(?:No .*|Try .*|Loading).*$/i, "").trim()
    const options = input instanceof HTMLSelectElement

      ? Array.from(input.options).map((option) => option.text.trim()).filter((option) => option && !/^(select|choose|please select)(?:\s+an\s+answer)?\.{0,3}$/i.test(option))
      : input.type === "radio" && directLabel ? [directLabel.trim()] : []
    const currentValue = input instanceof HTMLSelectElement ? input.value : input.value
    const selectedText = input instanceof HTMLSelectElement ? input.selectedOptions[0]?.textContent?.trim() ?? "" : currentValue
    const filled = input instanceof HTMLSelectElement
      ? Boolean(input.value && !/^(select|choose|please select)\.{0,3}$/i.test(selectedText))
      : input.type === "radio" || input.type === "checkbox"
        ? input.checked
        : input.type === "file"
          ? Boolean(input.files?.length)
          : Boolean(input.value?.trim())
    return {
      key: input.name || input.id || `field-${Math.random().toString(36).slice(2)}`,
      label,
      type: input.type || input.tagName.toLowerCase(),

      required: input.required || input.getAttribute("aria-required") === "true" || /\*/.test(directLabel || label),
      options,
      filled,
      value: currentValue,
      autocomplete: input.getAttribute("autocomplete") || undefined,
      selector: input.id ? `#${input.id}` : input.name ? `[name="${input.name}"]` : undefined,
      source: label ? "dom" : "fallback",
    }
  }).filter(Boolean) as RequiredField[])


  const customFields = await page.locator("[role='radio'], [role='checkbox'], [role='combobox'], [role='textbox'], [role='listbox'], [aria-haspopup='listbox'], [aria-expanded], [aria-controls], [data-state][data-value], [contenteditable='true']").evaluateAll((elements) => elements.flatMap((element, index) => {
    if (element.matches("input, textarea, select")) return []
    const clean = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").replace(/\s*[✱*].*$/, "").trim()
    const role = element.getAttribute("role")
      || (element.getAttribute("contenteditable") === "true" ? "textbox" : "")
      || (element.getAttribute("aria-haspopup") === "listbox" || element.hasAttribute("aria-controls") || element.hasAttribute("aria-expanded") ? "combobox" : "text")

    if (role === "listbox" || role === "option") return []
    const group = element.closest("fieldset, [role='radiogroup'], [role='group'], [data-question], [data-field], .application-question, .application-field, .form-field, .form-group, .field")
    const labelledBy = (element.getAttribute("aria-labelledby") ?? "").split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ")
    const question = clean(group?.querySelector("legend, [data-question], [data-label], [data-qa*='question'], .question-label, .field-label, .application-label, label")?.textContent || group?.getAttribute("aria-label") || labelledBy || element.getAttribute("aria-label"))
    const key = element.getAttribute("name") || element.id || element.getAttribute("data-field") || element.getAttribute("data-testid") || element.getAttribute("data-qa") || `aria-field-${index}`
    const options = /radio|checkbox|combobox|listbox/.test(role) && group
      ? Array.from(group.querySelectorAll("[role='radio'], [role='checkbox'], [role='option']")).map((option) => clean(option.getAttribute("aria-label") || option.textContent)).filter(Boolean)
      : []
    const displayedValue = clean(element.getAttribute("data-value") || element.getAttribute("value") || (element as HTMLElement).innerText)
    const filled = /radio|checkbox/.test(role)
      ? Boolean(group?.querySelector("[aria-checked='true'], [aria-selected='true'], [data-state='checked']"))
      : Boolean(displayedValue && !/^(select|choose|please select)\.{0,3}$/i.test(displayedValue))
    const required = element.getAttribute("aria-required") === "true" || group?.getAttribute("aria-required") === "true" || /\brequired\b|[✱*]/i.test(`${question} ${group?.textContent ?? ""}`)
    const selector = element.id ? `#${element.id}` : element.getAttribute("name") ? `[name="${element.getAttribute("name")}"]` : element.getAttribute("data-field") ? `[data-field="${element.getAttribute("data-field")}"]` : element.getAttribute("data-testid") ? `[data-testid="${element.getAttribute("data-testid")}"]` : element.getAttribute("data-qa") ? `[data-qa="${element.getAttribute("data-qa")}"]` : undefined
    return [{ key, label: question, type: role, required, options: [...new Set(options)], filled, value: displayedValue, selector, source: question ? "dom" : "fallback" }]
  }) as RequiredField[])
  const fields = [...nativeFields, ...customFields]

  let normalized = Object.values(fields.reduce<Record<string, RequiredField>>((groups, field) => {
    const groupKey = field.type === "radio" ? `radio:${field.key}` : `${field.type}:${field.key}`
    const current = groups[groupKey]
    if (!current) {
      groups[groupKey] = { ...field, label: field.label || "", options: field.options }
    } else {
      current.required ||= field.required
      current.filled ||= field.filled
      current.options = [...new Set([...(current.options ?? []), ...(field.options ?? [])])]
    }
    return groups
  }, {})).map((field) => ({
    ...field,
    required: field.required || (platform !== "other" && /resume|email|name/i.test(field.label)),
  }))
  await discoverCustomDropdownOptions(page, normalized)
  if (platform === "lever") {
    const leverQuestions = new Map((await getLeverCardQuestions(page)).map((question) => [question.key, question]))
    normalized = normalized.map((field) => {
      const question = leverQuestions.get(field.key)
      return question
        ? { ...field, label: question.label, required: question.required, options: question.options.length ? question.options : field.options }
        : field
    })

    normalized = normalized.filter((field) => !field.key.startsWith("eeo["))

  }
  if (!stagehand) return logFormScan(normalized)

  try {
    const extracted = await stagehand.extract(
      "Inspect only the visible application form, not the job description. Discover every required applicant question, including custom ARIA controls. Return a real DOM name, id, data-field, data-qa, or data-testid as key whenever it is visible, plus the complete human-facing prompt and visible choices. Do not invent prompts, options, or controls.",
      z.object({
        questions: z.array(z.object({ key: z.string().default(""), question: z.string(), options: z.array(z.string()).default([]) })),
      }),

      { page, serverCache: false, timeout: 60_000 }
    )
    const questions = extracted.questions.filter((item) => item.question.trim())
    const questionsByKey = new Map(questions.filter((question) => question.key).map((question) => [question.key, question]))
    const normalizeQuestion = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    const questionsByPrompt = new Map(questions.map((question) => [normalizeQuestion(question.question), question]))
    normalized.forEach((field) => {
      const question = questionsByKey.get(field.key) || questionsByPrompt.get(normalizeQuestion(field.label))
      if (!question) return
      if (!field.label.trim()) field.label = question.question
      if (!field.options?.length && question.options.length) field.options = question.options
    })

    for (const question of questions.filter((item) => !item.key && item.options.length)) {
      const normalizedOptions = question.options.map(normalizeQuestion).sort().join("|")
      const candidates = normalized.filter((field) => !field.label.trim() && (field.options ?? []).map(normalizeQuestion).sort().join("|") === normalizedOptions)
      if (candidates.length === 1) {
        candidates[0].label = question.question
        candidates[0].source = "semantic"
      }
    }

    for (const question of questions) {
      if (question.key && !normalized.some((field) => field.key === question.key)) {
        console.info("[FORM SCAN] Semantic question could not be resolved to a DOM control", question.key)
      }
    }
  } catch {
    // Native labels remain the fallback when the page cannot be semantically read.
  }
  return logFormScan(normalized)
}

function logFormScan(fields: RequiredField[]) {
  const result = fields.map((field, index) => {
    const label = field.label || `Required application question ${index + 1}`
    const source = field.label ? field.source ?? "dom" : "fallback"
    if (!field.label && field.required) console.info("[FORM SCAN] Could not determine human question for field", { key: field.key, type: field.type, required: true })
    console.info("[FORM FIELD]", { key: field.key, question: label, type: field.type, required: field.required, filled: field.filled, value: field.value ?? "", options: field.options ?? [], source })
    return { ...field, label, source }
  })
  const required = result.filter((field) => field.required)
  console.info("[FORM SCAN] Complete", { total: result.length, required: required.length, filled: required.filter((field) => field.filled).length, missing: required.filter((field) => !field.filled).length })
  return result
}

async function logFinalFormValidation(page: Page, fields: RequiredField[]) {
  const required = fields.filter((field) => field.required)
  const missing = required.filter((field) => !field.filled)
  const optionalFilled = fields.filter((field) => !field.required && field.filled)
  console.info("[FINAL FORM VALIDATION]")
  console.info(`Total discovered fields: ${fields.length}`)
  console.info(`Required fields: ${required.length}`)
  console.info(`Filled required fields: ${required.length - missing.length}`)
  console.info(`Missing required fields: ${missing.length}`)
  console.info(`Optional fields filled: ${optionalFilled.length}`)
  const blockingErrors = await page.locator("input, select, textarea").evaluateAll((elements) =>
    elements.filter((element) => {
      const control = element as HTMLInputElement
      return control.willValidate && !control.disabled && !control.validity.valid
    }).length
  ).catch(() => 0)
  console.info(`Blocking validation errors: ${blockingErrors}`)
  if (missing.length) {
    console.info("[MISSING REQUIRED]", missing.map((field, index) => `${index + 1}. ${field.label}`))
    console.info("[SUBMISSION BLOCKED] Reason: required fields are incomplete.")
  } else {
    console.info("[SUBMISSION ALLOWED] All required fields are complete.")
  }
  return missing
}

function hasSubmissionConfirmation(text: string) {

  return /thank you for (applying|your application)|thanks? for (applying|your application)|application (has been )?submitted|application (has been )?received|we(?:'ve| have) received your application|application complete|successfully (applied|submitted)|your application is complete/i.test(text)
}

async function hasSubmissionSuccess(page: Page) {

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
    if (page.isClosed()) return false
    try {
      if (await hasSubmissionSuccess(page)) return true
      await page.waitForTimeout(500)
    } catch {
      return false
    }
  }
  return false
}

async function getInvalidRequiredFields(page: Page): Promise<RequiredField[]> {

  const scanned = await detectRequiredFields(page, "other")
  const unresolved = scanned.filter((field) => field.required && !field.filled)
  if (unresolved.length) return unresolved
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
  | { outcome: "manual_review_required"; diagnostic?: string }
  | { outcome: "validation_required"; fields: RequiredField[] }

async function selectLocationSuggestion(page: Page, locator: Locator, value: string) {
  // Lever's location control is an autocomplete, not a normal text field.
  // Its results are rendered a little after the input event and do not always
  // use `role=option`, so wait briefly and look for the common list patterns.
  await page.waitForTimeout(900)
  const cityToken = value.split(",")[0]?.trim().toLocaleLowerCase()
  
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
      
      await option.evaluate((element) => (element as HTMLElement).click())
      return true
    }
  }

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

export async function waitForManualVerification(page: Page, timeoutMs = 120_000): Promise<"submitted" | "timed_out" | "session_expired"> {
  const deadline = Date.now() + timeoutMs
  let submittedAfterVerification = false
  while (Date.now() < deadline) {
    if (page.isClosed()) return "session_expired"
    try {
      if (await hasSubmissionSuccess(page)) return "submitted"

    if (!submittedAfterVerification && await hasCaptchaToken(page)) {
      const submit = await findVisibleSubmitButton(page)
      if (submit) {
        await submit.click({ timeout: 5_000 }).catch(() => undefined)
        submittedAfterVerification = true

        await page.waitForLoadState("domcontentloaded", { timeout: 5_000 }).catch(() => undefined)
      }
    }
      await page.waitForTimeout(2_000)
    } catch {
      return "session_expired"
    }
  }
  return "timed_out"
}


export async function waitForManualApplicationSubmission(page: Page, timeoutMs = 120_000): Promise<"submitted" | "timed_out" | "session_expired"> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (page.isClosed()) return "session_expired"
    try {
      if (await hasSubmissionSuccess(page)) return "submitted"
      await page.waitForTimeout(2_000)
    } catch {
      return "session_expired"
    }
  }
  return "timed_out"
}

export async function fillAndSubmit(page: Page, values: Record<string, string>, resume: ResumeAttachment, fields: RequiredField[], stagehand?: Stagehand, platform?: AutomationPlatform): Promise<SubmitResult> {

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

        uploaded = true
        break
      } catch (error) {
        // Try another file input; some job boards include optional photo files.
        uploadErrors.push(error instanceof Error ? error.message : "The file input rejected the upload.")
      }
    }
    if (uploaded) break
  }

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

        await locator.selectOption({ value: selectedOption.value }, { force: true })

        completed = (await locator.inputValue().catch(() => "")) === selectedOption.value
      } else if (elementType.type === "radio") {
      const radios = page.locator(`[name="${escapedKey}"][type="radio"]`)
      const count = await radios.count()
      for (let index = 0; index < count; index += 1) {
        const radio = radios.nth(index)
        const label = await radio.evaluate((element) => (element as HTMLInputElement).labels?.[0]?.innerText || (element as HTMLInputElement).value)
        if (label.trim().toLowerCase() === value.trim().toLowerCase()) {

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
       
        completed = true
      } else {
        const isLocation = /current location|location|city|address/i.test(field.label)
        try {
          if (isLocation && platform === "lever") {
        
            await locator.click({ timeout: 5_000 })
            await locator.press("Control+A", { timeout: 5_000 })
            await locator.pressSequentially(value, { delay: 45, timeout: 5_000 })
            await selectLocationSuggestion(page, locator, value)
      
            if (await locationWasRejected(page)) {
              return { outcome: "validation_required", fields: [field] }
            }
            
            await locator.evaluate((input) => (input as HTMLElement).blur()).catch(() => undefined)
          } else {
            await locator.fill(value, { timeout: 5_000 })
            if (isLocation) await selectLocationSuggestion(page, locator, value)
          }
          completed = true
        } catch {

          completed = false
        }
      }
    }

    if (!completed && stagehand) {
      const actions = await stagehand.observe(
        `Find the input control for the required question: "${field.label}". Do not submit the form or change any value.`,
        { page, serverCache: false, timeout: 60_000 }
      )
      const action = actions[0]
      if (action) await stagehand.act({ ...action, arguments: [value] }, { page, serverCache: false, timeout: 60_000 })
    }
  }

  const finalFields = await detectRequiredFields(page, platform ?? "other", stagehand)
  const unresolvedFields = await logFinalFormValidation(page, finalFields)
  if (unresolvedFields.length) {
    console.info("[FORM DECISION] Required questions need applicant input", unresolvedFields.map((field) => field.label))
    return { outcome: "validation_required", fields: unresolvedFields }
  }

  let submissionResponse: string | undefined
  const onResponse = (response: { url: () => string; status: () => number; statusText: () => string; request: () => { method: () => string } }) => {
    const url = response.url()
    // Record only the employer's form POST, never CAPTCHA-solver traffic.
    if (response.request().method() === "POST" && /jobs\.lever\.co|boards\.greenhouse\.io|apply\.workable\.com|wellfound\.com/i.test(url)) {
      submissionResponse = `${response.status()} ${response.statusText()} — ${new URL(url).pathname}`
    }
  }
  page.on("response", onResponse)
  const submit = await findVisibleSubmitButton(page)
  let submitClicked = false
  if (submit) {
    try {
      await submit.click({ timeout: 5_000 })
      submitClicked = true
    } catch {
      
    }
  }
  if (!submitClicked && stagehand) {
    try {
      await stagehand.act(
        "Click the application form's final Submit button. Do not click any other button.",
        { page, serverCache: false, timeout: 60_000 }
      )
      submitClicked = true
    } catch {
    
    }
  }

  await page.waitForLoadState("domcontentloaded", { timeout: 5_000 }).catch(() => undefined)

  if (!await waitForSubmissionConfirmation(page, 20_000)) {
    const invalidFields = await getInvalidRequiredFields(page)
    if (invalidFields.length) return { outcome: "validation_required", fields: invalidFields }
    if (await hasVisibleCaptchaChallenge(page)) {

      page.off("response", onResponse)
      return { outcome: "captcha_required" }
    }

    const visibleError = await page.locator('[role="alert"], .error, .errors, .alert-danger, .form-error, .application-error').allInnerTexts().catch(() => [])
    page.off("response", onResponse)
    return {
      outcome: "manual_review_required",
      diagnostic: [submissionResponse, ...visibleError.map((message) => message.replace(/\s+/g, " ").trim()).filter(Boolean)].filter(Boolean).join(" | ") || undefined,
    }
  }
  page.off("response", onResponse)
  return { outcome: "submitted" }
}
