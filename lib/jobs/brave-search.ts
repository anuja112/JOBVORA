const BRAVE_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search"

// Brave's Free plan allows only 1 request per second. We search one
// platform at a time (see fetchJobsAction), so this module-level throttle
// makes sure consecutive calls never land in the same 1s window even when
// the previous call resolved quickly.
const MIN_INTERVAL_MS = 1100
let lastCallAt = 0

async function waitForRateLimit() {
  const elapsed = Date.now() - lastCallAt
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed))
  }
  lastCallAt = Date.now()
}

export type BraveWebResult = {
  title: string
  url: string
  description?: string

  age?: string
  meta_url?: {
    hostname?: string
    favicon?: string
  }
}

type BraveSearchResponse = {
  web?: {
    results?: BraveWebResult[]
  }
}

type BraveSearchOutcome =
  | { success: true; results: BraveWebResult[] }
  | { success: false; error: string }

/**
 * Calls the Brave Search API for a single, already-built query string.
 * `freshness: "pw"` limits results to the past week, matching the pattern
 * given in the spec. Automatically retries once (after a longer backoff)
 * if Brave responds 429 (rate limited).
 */
export async function searchBrave(
  query: string,
  attempt = 1
): Promise<BraveSearchOutcome> {
  const apiKey = process.env.BRAVE_API_KEY
  if (!apiKey) {
    return {
      success: false,
      error: "BRAVE_API_KEY is not set. Add it to your .env.local file.",
    }
  }

  await waitForRateLimit()

  const params = new URLSearchParams({
    q: query,
    freshness: "pw",
    count: "20",
  })

  try {
    const response = await fetch(`${BRAVE_SEARCH_ENDPOINT}?${params}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
      // Brave results change frequently; we do our own 6h caching in
      // Supabase rather than relying on Next's fetch cache here.
      cache: "no-store",
    })

    if (response.status === 429 && attempt < 3) {
      // Back off harder than the base throttle and try again.
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
      return searchBrave(query, attempt + 1)
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "")
      return {
        success: false,
        error:
          response.status === 429
            ? "Brave Search rate limit hit (Free plan allows 1 request/sec). Please try again in a few seconds."
            : `Brave Search API returned ${response.status}: ${bodyText.slice(0, 300) || response.statusText}`,
      }
    }

    const body = (await response.json()) as BraveSearchResponse
    return { success: true, results: body.web?.results ?? [] }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? `Failed to reach Brave Search API: ${error.message}`
          : "Unknown error calling the Brave Search API.",
    }
  }
}
