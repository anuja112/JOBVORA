import { Briefcase } from "lucide-react"

import { PagePlaceholder } from "@/components/dashboard/page-placeholder"

export default function JobsPage() {
  return (
    <PagePlaceholder
      icon={Briefcase}
      title="Jobs"
      description="Matched roles from across the web will show up here, ready to review and apply to."
    />
  )
}
