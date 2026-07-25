import { UserRound } from "lucide-react"

import { PagePlaceholder } from "@/components/dashboard/page-placeholder"

export default function ProfilePage() {
  return (
    <PagePlaceholder
      icon={UserRound}
      title="Profile"
      description="Your work history, skills, and preferences will live here."
    />
  )
}
