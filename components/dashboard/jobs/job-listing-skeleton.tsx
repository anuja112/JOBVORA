import { Skeleton } from "@/components/ui/skeleton"

export function JobListingSkeleton() {
  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border p-4 sm:flex-row">
      <Skeleton className="size-12 shrink-0 rounded-2xl" />
      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-3.5 w-64" />
        <Skeleton className="h-3.5 w-full max-w-md" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <div className="flex gap-2 sm:flex-col">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
    </div>
  )
}

export function JobListingSkeletonGroup({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <JobListingSkeleton key={i} />
      ))}
    </div>
  )
}
