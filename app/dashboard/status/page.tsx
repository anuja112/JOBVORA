import { ListChecks } from "lucide-react"

import { PagePlaceholder } from "@/components/dashboard/page-placeholder"

export default function ApplicationStatusPage() {
  return (
    <PagePlaceholder
      icon={ListChecks}
      title="Application Status"
      description="Track every application as it moves from submitted to offer."
    />
  )
}
