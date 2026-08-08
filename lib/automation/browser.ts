import "server-only"

import { Browserbase } from "@browserbasehq/sdk"
import { Stagehand } from "@browserbasehq/stagehand"
import { chromium } from "playwright"

function getStagehandModel() {
  const configuredModel = (process.env.STAGEHAND_MODEL ?? "google/gemini-2.0-flash").trim()

  // Stagehand v3 requires `provider/model`. Keeping this normalization lets an
  // existing `gemini-*` value continue to work while making the provider
  // explicit for new configurations.
  return configuredModel.includes("/") ? configuredModel : `google/${configuredModel}`
}

export async function withBrowserbasePage<T>(
  task: (page: import("playwright").Page, sessionId: string, stagehand: Stagehand) => Promise<T>,
  options?: { keepAlive?: boolean }
) {
  const apiKey = process.env.BROWSERBASE_API_KEY
  if (!apiKey) throw new Error("BROWSERBASE_API_KEY is not configured.")
  const geminiApiKey = process.env.GEMINI_API_KEY
  if (!geminiApiKey) throw new Error("GEMINI_API_KEY is not configured.")

  const browserbase = new Browserbase({ apiKey })
  // A replay remains available after a session completes, so this must not be
  // kept alive. That prevents abandoned background jobs consuming all browser
  // slots until their timeout.
  const session = await browserbase.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    // Submission handoffs need to survive a short CDP/Stagehand reconnect so
    // the applicant can open the live form and take over. Inspection sessions
    // remain ephemeral to avoid spending browser time on background scans.
    keepAlive: options?.keepAlive ?? false,
    // A five-minute cap covers a normal scan/submission and prevents an
    // abandoned session from consuming Browserbase minutes for too long. The
    // manual handoff itself is capped at two minutes by the workflow.
    timeout: 300,
  })
  let stagehand: Stagehand | undefined
  let browser: import("playwright").Browser | undefined

  try {
    // Initialize Stagehand against this exact Browserbase session. It gives the
    // workflow AI-aware navigation/extraction capability with the Gemini key.
    stagehand = new Stagehand({
      env: "BROWSERBASE",
      apiKey,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      browserbaseSessionID: session.id,
      model: {
        modelName: getStagehandModel(),
        apiKey: geminiApiKey,
      },
      disablePino: true,
    })
    await stagehand.init()
    browser = await chromium.connectOverCDP(session.connectUrl)
    const context = browser.contexts()[0]
    const page = context.pages()[0] ?? await context.newPage()
    return await task(page, session.id, stagehand)
  } finally {
    // Release even if Stagehand init or CDP connection fails. Browserbase keeps
    // the completed replay for debugging, but it immediately frees the slot.
    await Promise.allSettled([
      browser?.close(),
      stagehand?.close(),
      browserbase.sessions.update(session.id, { status: "REQUEST_RELEASE" }),
    ])
  }
}
