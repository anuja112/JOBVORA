import { Sparkles } from "lucide-react"

export function WelcomeBanner({ name }: { name: string }) {
  return (
    <div className="overflow-hidden rounded-4xl border bg-gradient-to-br from-primary/50 via-primary/20 to-card p-6 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground text-primary">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Welcome back, {name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick the job boards you want to search, and Jobvora will pull in
            roles matched to your profile — skills, experience, and
            preferred location included.
          </p>
        </div>
      </div>
    </div>
  )
}
