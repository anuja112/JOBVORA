"use client"

import Image from "next/image"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { JOB_PLATFORMS } from "@/lib/jobs/platforms"
import type { JobPlatform } from "@/lib/supabase/database.types"

export function PlatformSelector({
  selected,
  onChange,
  disabled,
}: {
  selected: JobPlatform[]
  onChange: (next: JobPlatform[]) => void
  disabled?: boolean
}) {
  function toggle(platform: JobPlatform) {
    if (disabled) return
    onChange(
      selected.includes(platform)
        ? selected.filter((p) => p !== platform)
        : [...selected, platform]
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {JOB_PLATFORMS.map((platform) => {
        const isSelected = selected.includes(platform.id)
        return (
          <button
            key={platform.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(platform.id)}
            aria-pressed={isSelected}
            className={cn(
              "group relative flex flex-col items-center gap-2.5 rounded-3xl border p-4 text-center transition-all disabled:pointer-events-none disabled:opacity-60",
              isSelected
                ? "border-primary-foreground/30 bg-primary/40 shadow-md ring-1 ring-primary-foreground/20"
                : "border-border bg-card hover:border-primary-foreground/20 hover:bg-muted/40"
            )}
          >
            {isSelected && (
              <span className="absolute top-2.5 right-2.5 flex size-5 items-center justify-center rounded-full bg-primary-foreground text-primary">
                <Check className="size-3" strokeWidth={3} />
              </span>
            )}
            <span className="relative flex size-11 items-center justify-center overflow-hidden rounded-2xl shadow-sm">
              <Image
                src={platform.logo}
                alt={`${platform.name} logo`}
                width={44}
                height={44}
                className="size-full"
              />
            </span>
            <span className="text-sm font-medium">{platform.name}</span>
          </button>
        )
      })}
    </div>
  )
}
