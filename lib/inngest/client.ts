import { Inngest } from "inngest"


export const inngest = new Inngest({
  id: "jobvora",
  isDev: process.env.NODE_ENV === "development",
})
