import { NextResponse } from "next/server"
import type Stripe from "stripe"

import { getBillingPlan } from "@/lib/billing/plans"
import { getStripe } from "@/lib/billing/stripe"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/supabase/database.types"

export const runtime = "nodejs"

const stripeId = (value: string | { id: string } | null) => typeof value === "string" ? value : value?.id ?? null
const asDate = (timestamp: number | undefined) => timestamp ? new Date(timestamp * 1000).toISOString() : null

async function recordEvent(event: Stripe.Event, userId: string, details: Record<string, unknown>, subscription?: Stripe.Subscription) {
  const admin = createAdminClient()
  const subscriptionId = subscription?.id ?? null
  const customerId = subscription ? stripeId(subscription.customer) : null
  await admin.from("billing_history").upsert({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    stripe_event_id: event.id,
    plan_name: subscription?.metadata.planName ?? null,
    payment_status: subscription?.status ?? null,
    event_type: event.type,
    details: JSON.parse(JSON.stringify(details)) as Json,
  }, { onConflict: "stripe_event_id" })
}

async function syncSubscription(subscription: Stripe.Subscription, fallbackUserId?: string) {
  const admin = createAdminClient()
  const customerId = stripeId(subscription.customer)
  const { data: existing } = await admin.from("user_subscriptions")
    .select("user_id")
    .or(`stripe_subscription_id.eq.${subscription.id},stripe_customer_id.eq.${customerId}`)
    .maybeSingle()
  const userId = subscription.metadata.userId || fallbackUserId || existing?.user_id
  if (!userId) throw new Error(`No JobVora user mapping exists for Stripe subscription ${subscription.id}.`)

  const isCancelled = subscription.status === "canceled" || subscription.status === "unpaid"
  const plan = getBillingPlan(isCancelled ? "free" : subscription.metadata.plan)
  const period = subscription.items.data[0]
  const { error } = await admin.from("user_subscriptions").upsert({
    user_id: userId,
    plan: plan.id,
    plan_name: plan.name,
    plan_limit: plan.limit,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    payment_status: subscription.status === "active" || subscription.status === "trialing" ? "paid" : subscription.status,
    current_period_start: asDate(period?.current_period_start),
    current_period_end: asDate(period?.current_period_end),
  }, { onConflict: "user_id" })
  if (error) throw error
  return userId
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature")
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !secret) return NextResponse.json({ error: "Stripe webhook signature is not configured." }, { status: 400 })

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret)
  } catch (error) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${error instanceof Error ? error.message : "unknown error"}` }, { status: 400 })
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId ?? session.client_reference_id ?? undefined
      const subscriptionId = stripeId(session.subscription)
      if (userId && subscriptionId) {
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
        const syncedUserId = await syncSubscription(subscription, userId)
        await recordEvent(event, syncedUserId, { checkoutSessionId: session.id, amountTotal: session.amount_total, currency: session.currency }, subscription)
      }
    } else if (event.type.startsWith("customer.subscription.")) {
      const subscription = event.data.object as Stripe.Subscription
      const userId = await syncSubscription(subscription)
      await recordEvent(event, userId, { status: subscription.status }, subscription)
    } else if (event.type === "invoice.payment_succeeded" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = stripeId(invoice.parent?.subscription_details?.subscription ?? null)
      if (subscriptionId) {
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
        const userId = await syncSubscription(subscription)
        await recordEvent(event, userId, { invoiceId: invoice.id, amountPaid: invoice.amount_paid, currency: invoice.currency }, subscription)
      }
    }
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Stripe webhook processing failed:", error)
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 })
  }
}
