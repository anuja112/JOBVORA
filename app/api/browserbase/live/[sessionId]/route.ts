import { NextResponse } from "next/server"
import { Browserbase } from "@browserbasehq/sdk"

import { createClient } from "@/lib/supabase/server"

// A Browserbase live-view URL is short-lived and should never be stored in the
// database or exposed to another account. Authorize ownership first, then
// obtain a fresh URL only when the applicant opens this route.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL("/sign-in", _request.url))

  const { data: application } = await supabase
    .from("job_applications")
    .select("id")
    .eq("user_id", user.id)
    .eq("browserbase_session_id", sessionId)
    .maybeSingle()
  if (!application) return new NextResponse("Browser session not found.", { status: 404 })

  const apiKey = process.env.BROWSERBASE_API_KEY
  if (!apiKey) return new NextResponse("Browserbase is not configured.", { status: 503 })

  try {
    const liveUrls = await new Browserbase({ apiKey }).sessions.debug(sessionId)
    return NextResponse.redirect(liveUrls.debuggerFullscreenUrl)
  } catch {
    return new NextResponse("This verification session is no longer active. Start another application attempt.", { status: 410 })
  }
}
