import { NextResponse } from "next/server"

import { getBillingPlan } from "@/lib/billing/plans"
import { getAppUrl, getStripe } from "@/lib/billing/stripe"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 })

  const body = await request.json().catch(() => null) as { plan?: string } | null
  const plan = getBillingPlan(body?.plan)
  if (plan.id === "free" || body?.plan !== plan.id) {
    return NextResponse.json({ error: "Choose Pro or Unlimited to start a paid subscription." }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    // Subscription rows are server-managed so applicants cannot modify their
    // own plan or allowance through RLS-exposed writes.
    const admin = createAdminClient()
    const { data: current } = await admin
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle()

    let customerId = current?.stripe_customer_id ?? null
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email ?? undefined, metadata: { userId: user.id } })
      customerId = customer.id
      const { error: subscriptionError } = await admin.from("user_subscriptions").upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        plan: "free",
        plan_name: "Free",
        plan_limit: 5,
        subscription_status: "incomplete",
        payment_status: "pending",
      })
      if (subscriptionError) throw subscriptionError
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      success_url: `${getAppUrl()}/dashboard/billing?checkout=success`,
      cancel_url: `${getAppUrl()}/dashboard/billing?checkout=cancelled`,
      metadata: { userId: user.id, plan: plan.id, planName: plan.name, planLimit: String(plan.limit ?? "unlimited") },
      subscription_data: { metadata: { userId: user.id, plan: plan.id, planName: plan.name, planLimit: String(plan.limit ?? "unlimited") } },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: plan.amountCents,
          recurring: { interval: plan.interval },
          product_data: { name: `JobVora ${plan.name}`, metadata: { plan: plan.id } },
        },
      }],
    })
    if (!session.url) return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start checkout." }, { status: 500 })
  }
}
