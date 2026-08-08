import { Inngest } from "inngest"

// Next's development server must explicitly use Inngest's local Dev Server,
// even when cloud event/signing keys are present in .env.local.
export const inngest = new Inngest({
  id: "jobvora",
  isDev: process.env.NODE_ENV === "development",
})
