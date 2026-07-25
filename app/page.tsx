import Link from "next/link"
import {
  ArrowRight,
  Briefcase,
  Bot,
  Sparkles,
  Target,
  Zap,
} from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function HomePage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const isLoggedIn = !!data?.claims

  const features = [
    {
      icon: Bot,
      title: "AI-Powered Applications",
      description:
        "Generate tailored cover letters and answers for every job application automatically.",
    },
    {
      icon: Target,
      title: "Smart Job Matching",
      description:
        "Find roles that match your skills, experience, and career goals with precision.",
    },
    {
      icon: Zap,
      title: "Apply Faster",
      description:
        "Automate repetitive form filling so you can focus on interviews, not paperwork.",
    },
  ]

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.75_0.12_250/0.12),transparent)]"
      />

      <header className="relative z-10 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Briefcase className="size-4" />
            </div>
            <span className="font-semibold tracking-tight">Job Agent</span>
          </Link>

          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <Link href="/dashboard" className={cn(buttonVariants())}>
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className={cn(buttonVariants({ variant: "ghost" }))}
                >
                  Sign in
                </Link>
                <Link href="/sign-up" className={cn(buttonVariants())}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col">
        <section className="mx-auto flex max-w-6xl flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:px-6 sm:py-32">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
            <Sparkles className="size-3.5" />
            AI-powered job search assistant
          </div>

          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Land your dream job with{" "}
            <span className="text-primary">intelligent automation</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Job Agent helps you discover matching roles, craft personalized
            applications, and track every submission — so you spend less time
            applying and more time interviewing.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ size: "lg" }))}
              >
                Go to dashboard
                <ArrowRight />
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-up"
                  className={cn(buttonVariants({ size: "lg" }))}
                >
                  Get started free
                  <ArrowRight />
                </Link>
                <Link
                  href="/sign-in"
                  className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </section>

        <section className="border-t bg-muted/30 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mb-12 text-center">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Everything you need to job hunt smarter
              </h2>
              <p className="mt-3 text-muted-foreground">
                Built for modern job seekers who want an edge.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              {features.map((feature) => (
                <Card key={feature.title} className="border-border/60 bg-card/80">
                  <CardHeader>
                    <div className="mb-2 flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <feature.icon className="size-5" />
                    </div>
                    <CardTitle className="text-base">{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Job Agent. All rights reserved.</p>
      </footer>
    </div>
  )
}
