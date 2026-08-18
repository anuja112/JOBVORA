import { NextResponse } from "next/server"

import { getAppUrl, getStripe } from "@/lib/billing/stripe"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 })
  const { data: subscription } = await supabase.from("user_subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle()
  if (!subscription?.stripe_customer_id) return NextResponse.json({ error: "No Stripe billing account exists yet." }, { status: 400 })
  try {
    const session = await getStripe().billingPortal.sessions.create({ customer: subscription.stripe_customer_id, return_url: `${getAppUrl()}/dashboard/billing` })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not open the billing portal." }, { status: 500 })
  }
}
