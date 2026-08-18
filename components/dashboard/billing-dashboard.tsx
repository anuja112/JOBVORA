"use client";

import * as React from "react";
import {
  Check,
  CreditCard,
  ExternalLink,
  Loader2,
  Sparkles,
} from "lucide-react";

import {
  BILLING_PLANS,
  formatPlanPrice,
  type BillingPlan,
} from "@/lib/billing/plans";
import type { SubscriptionSummary } from "@/lib/supabase/queries/subscriptions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function BillingDashboard({
  summary,
}: {
  summary: SubscriptionSummary;
}) {
  const [pendingPlan, setPendingPlan] = React.useState<string | null>(null);
  const [portalPending, setPortalPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const checkout = async (plan: BillingPlan) => {
    setPendingPlan(plan.id);
    setError(null);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan.id }),
      });
      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.url)
        throw new Error(result.error ?? "Could not open Stripe Checkout.");
      window.location.assign(result.url);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not open Stripe Checkout.",
      );
      setPendingPlan(null);
    }
  };

  const openPortal = async () => {
    setPortalPending(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.url)
        throw new Error(result.error ?? "Could not open the billing portal.");
      window.location.assign(result.url);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not open the billing portal.",
      );
      setPortalPending(false);
    }
  };

  const selectPlan = async (plan: BillingPlan) => {
    const hasManageableSubscription = Boolean(
      summary.subscriptionId &&
      summary.customerId &&
      !["canceled", "unpaid"].includes(summary.status),
    );
    if (hasManageableSubscription) return openPortal();
    return checkout(plan);
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-4xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
          <div>
            <p className="text-primary-foreground">Current plan</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">
              {summary.plan.name}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {summary.plan.description}
            </p>
          </div>
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm">
            <p className="text-muted-foreground">Subscription status</p>
            <p className="mt-1 font-semibold capitalize text-primary-foreground">
              {summary.status.replace(/_/g, " ")}
            </p>
          </div>
        </div>
      </section>

      <section
        className="grid gap-4 md:grid-cols-2"
        aria-label="Usage information"
      >
        <Card>
          <CardHeader>
            <CardTitle>AI applications today</CardTitle>
            <CardDescription>
              Usage resets at midnight in your account&apos;s database day.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">
              {summary.usedToday}
              {summary.plan.limit === null ? "" : ` / ${summary.plan.limit}`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Remaining today</CardTitle>
            <CardDescription>
              AI-assisted applications you can begin today.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">
              {summary.remainingToday === null
                ? "Unlimited usage"
                : summary.remainingToday}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-4xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold">Manage subscription</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Update payment details, cancel, or change your paid plan securely
              in Stripe.
            </p>
          </div>
          <Button
            className="rounded-xl !bg-primary-foreground !text-white hover:!bg-primary-foreground/90 disabled:!opacity-100"
            variant="outline"
            onClick={openPortal}
            disabled={!summary.customerId || portalPending}
          >
            {portalPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <CreditCard />
            )}{" "}
            Manage in Stripe <ExternalLink />
          </Button>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Available plans</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose the daily AI application capacity that fits your job search.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {Object.values(BILLING_PLANS).map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              currentPlan={summary.plan.id}
              pending={pendingPlan === plan.id || portalPending}
              manageExisting={Boolean(
                summary.subscriptionId &&
                summary.customerId &&
                !["canceled", "unpaid"].includes(summary.status),
              )}
              onSelect={selectPlan}
            />
          ))}
        </div>
      </section>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </main>
  );
}

function PlanCard({
  plan,
  currentPlan,
  pending,
  manageExisting,
  onSelect,
}: {
  plan: BillingPlan;
  currentPlan: string;
  pending: boolean;
  manageExisting: boolean;
  onSelect: (plan: BillingPlan) => void;
}) {
  const current = plan.id === currentPlan;
  const label = current
    ? "Current plan"
    : plan.id === "free"
      ? "Included"
      : manageExisting
        ? "Change in Stripe"
        : `Choose ${plan.name}`;
  return (
    <Card
  className={
    plan.id === "pro"
      ? "border-2 border-sky-200 bg-sky-50/30 shadow-md"
      : ""
  }
>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{plan.name}</CardTitle>
          {plan.id === "pro" ? (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
  Popular
</span>
          ) : null}
        </div>
        <CardDescription>{plan.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">
          {formatPlanPrice(plan)}
          {plan.amountCents ? (
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / month
            </span>
          ) : null}
        </p>
        <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
  {plan.features.map((feature) => (
    <li key={feature} className="flex items-start gap-2">
      <Check className="mt-0.5 size-4 shrink-0 text-primary-foreground" />
      <span>{feature}</span>
    </li>
  ))}
</ul>
      </CardContent>
      <CardFooter>
  <Button
  className={
    current
      ? "w-full rounded-xl !bg-primary-foreground !text-white hover:!bg-primary-foreground/90 disabled:!opacity-100"
      : "w-full"
  }
  variant="default"
  disabled={current || pending || plan.id === "free"}
    onClick={() => onSelect(plan)}
  >
    {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
    {label}
  </Button>
</CardFooter>
    </Card>
  );
}
