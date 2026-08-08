import { serve } from "inngest/next"
import { inngest } from "@/lib/inngest/client"
import { detectApplicationFields, reconcileStaleApplications, submitJobApplication } from "@/lib/inngest/functions"

export const { GET, POST, PUT } = serve({ client: inngest, functions: [detectApplicationFields, submitJobApplication, reconcileStaleApplications] })
