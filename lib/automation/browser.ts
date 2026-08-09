import "server-only"

import { Browserbase } from "@browserbasehq/sdk"
import { Stagehand } from "@browserbasehq/stagehand"
import { chromium } from "playwright"

function getStagehandModel() {
  const configuredModel = (process.env.STAGEHAND_MODEL ?? "google/gemini-2.0-flash").trim()


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

  const session = await browserbase.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID,

    keepAlive: options?.keepAlive ?? false,

    timeout: 300,
  })
  let stagehand: Stagehand | undefined
  let browser: import("playwright").Browser | undefined

  try {

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

    await Promise.allSettled([
      browser?.close(),
      stagehand?.close(),
      browserbase.sessions.update(session.id, { status: "REQUEST_RELEASE" }),
    ])
  }
}
