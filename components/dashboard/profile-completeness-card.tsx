"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export type CompletenessSection = {
  key: string
  label: string
  icon: React.ReactNode
  /** 0-100 */
  percent: number
  weight?: number
}

function CircularProgress({
  percent,
  size = 120,
  strokeWidth = 10,
}: {
  percent: number
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - percent / 100)

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-primary-foreground transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute text-2xl font-semibold tabular-nums">
        {Math.round(percent)}%
      </span>
    </div>
  )
}

function statusCopy(percent: number) {
  if (percent >= 100) {
    return { label: "Complete", text: "Your profile is complete." }
  }
  if (percent >= 70) {
    return { label: "Strong profile", text: "Just a few more details to go." }
  }
  if (percent >= 35) {
    return {
      label: "Almost there",
      text: "Fill in a few more details to stand out.",
    }
  }
  return {
    label: "Getting started",
    text: "Add more details so job matching works well.",
  }
}

export function ProfileCompletenessCard({
  sections,
  className,
}: {
  sections: CompletenessSection[]
  className?: string
}) {
  const totalWeight = sections.reduce((sum, s) => sum + (s.weight ?? 1), 0)
  const weightedPercent = sections.reduce(
    (sum, s) => sum + s.percent * (s.weight ?? 1),
    0
  )
  const overallPercent =
    totalWeight === 0 ? 0 : weightedPercent / totalWeight
  const status = statusCopy(overallPercent)

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-5 rounded-4xl border bg-card p-6 text-center shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10",
        className
      )}
    >
      <div>
        <h3 className="text-sm font-semibold">Profile completeness</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{status.text}</p>
      </div>

      <CircularProgress percent={overallPercent} />

      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
        <span className="size-1.5 rounded-full bg-primary-foreground" />
        {status.label}
      </span>

      <div className="w-full space-y-3.5 text-left">
        {sections.map((section) => (
          <div key={section.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <span className="text-muted-foreground">{section.icon}</span>
                {section.label}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {Math.round(section.percent)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary-foreground transition-[width] duration-500"
                style={{ width: `${Math.max(section.percent, 4)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
