import Link from "next/link"
import { ArrowRight, Briefcase, Check, Sparkles, Target, Zap } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const features = [
  {
    icon: Target,
    number: "01",
    title: "Find the right roles",
    description:
      "Search opportunities that fit your skills, goals, and preferred way of working.",
  },
  {
    icon: Sparkles,
    number: "02",
    title: "Make every application count",
    description:
      "Create tailored application materials without starting from a blank page.",
  },
  {
    icon: Zap,
    number: "03",
    title: "Keep your search moving",
    description:
      "Save roles and track each application in one focused workspace.",
  },
]

export default async function HomePage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const isLoggedIn = !!data?.claims

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[38rem] bg-[radial-gradient(circle_at_50%_12%,oklch(0.9_0.06_210/0.7),transparent_58%)]"
      />

      <header className="relative z-10 border-b border-border/70 bg-background/75 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Jobvora home">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Briefcase className="size-4" />
            </div>
            <span className="font-semibold tracking-tight">Jobvora</span>
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

      <main className="relative z-10 flex-1">
        <section className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-16 pb-14 text-center sm:px-6 sm:pt-20 sm:pb-20">
          <div className="mb-5 flex size-14 items-center justify-center rounded-2xl border border-primary-foreground/35 bg-primary/80 text-primary-foreground shadow-sm">
            <Briefcase className="size-6" />
          </div>

          <h1 className="text-5xl font-semibold tracking-[-0.06em] text-foreground sm:text-7xl lg:text-8xl">
            Jobvora
          </h1>

          <div className="mt-6 max-w-3xl">
            <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-primary-foreground uppercase">
              Your job search, in motion
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Land your dream job with intelligent automation.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Jobvora helps you discover matching roles, create personalized
              applications, and track every submission—so you can spend less
              time applying and more time interviewing.
            </p>
          </div>

          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ size: "lg" }), "min-w-44")}
              >
                Go to dashboard
                <ArrowRight />
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-up"
                  className={cn(buttonVariants({ size: "lg" }), "min-w-44")}
                >
                  Get started free
                  <ArrowRight />
                </Link>
                <Link
                  href="/sign-in"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "outline" }),
                    "min-w-28"
                  )}
                >
                  Sign in
                </Link>
              </>
            )}
          </div>

          <p className="mt-5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Check className="size-3.5 text-primary" />
            Organize your search from first role to final interview.
          </p>
        </section>

        <section className="border-y border-border/70 bg-background/65">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="grid gap-10 md:grid-cols-[0.8fr_2.2fr] md:gap-16">
              <div>
                <p className="text-sm font-medium text-[#5FAF9F]">
                  A clearer way to apply
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                  Built around the work that gets you hired.
                </h2>
              </div>

              <div className="grid gap-7 sm:grid-cols-3 sm:gap-5">
                {features.map((feature) => (
                  <div key={feature.number} className="border-t border-border pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium tracking-wider text-muted-foreground">
                        {feature.number}
                      </span>
                      <feature.icon className="size-4 text-primary" />
                    </div>
                    <h3 className="mt-6 text-base font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-white">
  <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
    <p className="text-sm text-muted-foreground">
      © 2026 Jobvora. Made by Anuja Ghosal
    </p>

    <div className="flex items-center gap-4">
      <span className="text-xs font-semibold tracking-widest text-muted-foreground">
        CONNECT
      </span>

      <a
        href="https://github.com/anuja112"
        target="_blank"
        rel="noopener noreferrer"
        className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground text-white transition hover:opacity-90"
        aria-label="GitHub"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5 fill-current"
          aria-hidden="true"
        >
          <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.17c-3.2.7-3.87-1.36-3.87-1.36-.53-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.95.1-.74.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.47.11-3.06 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.77.11 3.06.73.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.41-5.25 5.69.41.35.78 1.04.78 2.1v3.11c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
        </svg>
      </a>

      <a
        href="https://www.linkedin.com/in/anuja-ghosal"
        target="_blank"
        rel="noopener noreferrer"
        className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground text-white transition hover:opacity-90"
        aria-label="LinkedIn"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5 fill-current"
          aria-hidden="true"
        >
          <path d="M20.45 20.45h-3.56v-5.58c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.68H9.35V8.98h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.61 0 4.28 2.38 4.28 5.47v6.29ZM5.34 7.42a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM3.56 20.45h3.56V8.98H3.56v11.47ZM22.23 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.72V1.72C24 .77 23.21 0 22.23 0Z" />
        </svg>
      </a>
    </div>
  </div>
</footer>
    </div>
  )
}
