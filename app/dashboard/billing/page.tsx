import { CreditCard } from "lucide-react"

import { PagePlaceholder } from "@/components/dashboard/page-placeholder"

export default function BillingPage() {
  return (
    <PagePlaceholder
      icon={CreditCard}
      title="Billing & Credits"
      description="Manage your plan, top up credits, and view billing history."
    />
  )
}
