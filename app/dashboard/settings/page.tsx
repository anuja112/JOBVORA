import { Settings } from "lucide-react"

import { PagePlaceholder } from "@/components/dashboard/page-placeholder"

export default function SettingsPage() {
  return (
    <PagePlaceholder
      icon={Settings}
      title="Profile Settings"
      description="Account, notification, and privacy settings will live here."
    />
  )
}