import { FileText } from "lucide-react"

import { PagePlaceholder } from "@/components/dashboard/page-placeholder"

export default function ResumePage() {
  return (
    <PagePlaceholder
      icon={FileText}
      title="Resume"
      description="Upload your resume and let AI tailor it for every application."
    />
  )
}
