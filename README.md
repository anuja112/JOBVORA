# Jobvora

**Your job search, in motion.** Jobvora is an AI-powered job search and application platform that helps you discover matching roles, tailor your application materials, and automate the tedious parts of applying — so you can spend less time filling out forms and more time interviewing.

## Features

- 🎯 **Smart job discovery** — search for roles that match your skills, goals, and preferred way of working
- 📄 **AI resume parsing** — upload a resume and let Gemini extract your profile, work history, and education automatically
- 🤖 **Automated applications** — a browser automation agent (Browserbase + Playwright + Stagehand) fills out and submits applications on supported platforms
- 🧩 **Smart field mapping** — maps your profile data to each employer's application form, including custom screening questions
- 🔔 **Human-in-the-loop safeguards** — pauses for manual verification (e.g. CAPTCHAs) or manual review whenever automation can't safely proceed
- 📊 **Application tracking** — a dashboard to track saved jobs, application status, and progress from first application to final interview
- ⚙️ **Background job processing** — long-running application workflows are orchestrated with Inngest

### Supported application platforms

- Greenhouse
- Lever
- Workable
- Wellfound (AngelList)
- Generic fallback handling for other platforms

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js](https://nextjs.org) (App Router), React 19, TypeScript |
| Styling / UI | Tailwind CSS, shadcn/ui, Radix (Base UI), lucide-react |
| Database & Auth | [Supabase](https://supabase.com) (Postgres, Auth, Storage) |
| Browser automation | [Browserbase](https://www.browserbase.com/), Playwright, [Stagehand](https://www.stagehand.dev/) |
| AI / resume parsing | Google [Gemini](https://ai.google.dev/) API |
| Job search | Brave Search API |
| Background jobs | [Inngest](https://www.inngest.com/) |
| Validation | Zod |

## Project Structure

```
app/
  api/              API routes (Browserbase + Inngest webhooks)
  auth/             Auth-related routes
  dashboard/        Main app: jobs, saved jobs, resume, profile, status, billing, settings
  sign-in/          Sign-in page
  sign-up/          Sign-up page
components/
  auth/             Auth UI components
  dashboard/        Dashboard UI components
  ui/               Shared shadcn/ui components
lib/
  automation/       Browser automation: platform detection, form field mapping, submission handlers
  inngest/          Background job client + functions (the application automation pipeline)
  jobs/             Job search: query building, normalization, Brave Search integration
  resume/           Resume parsing (Gemini), schema, storage, persistence
  supabase/         Supabase client (browser, server, admin) and generated DB types
supabase/
  migrations/       SQL migrations for the Postgres schema
```

## Getting Started

### Prerequisites

- Node.js 18.18+ (or a version compatible with Next.js 16)
- A [Supabase](https://supabase.com) project
- A [Browserbase](https://www.browserbase.com/) account and API key
- A [Google Gemini](https://ai.google.dev/) API key
- A [Brave Search API](https://brave.com/search/api/) key
- (Optional) [Inngest](https://www.inngest.com/) account for production background job orchestration

### 1. Clone the repository

```bash
git clone https://github.com/anuja112/JOBVORA.git
cd JOBVORA
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root with the following variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Browser automation
BROWSERBASE_API_KEY=your_browserbase_api_key
BROWSERBASE_PROJECT_ID=your_browserbase_project_id
STAGEHAND_MODEL=your_stagehand_model_name

# AI / resume parsing
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=your_gemini_model_name

# Job search
BRAVE_API_KEY=your_brave_search_api_key
```

### 4. Set up the database

Apply the SQL migrations in `supabase/migrations/` to your Supabase project (via the Supabase CLI or dashboard SQL editor) to create the required tables (profiles, resumes, jobs, job preferences, job applications, work experience, and education).

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the app for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |

## How It Works

1. **Onboarding** — a user signs up, uploads a resume, and Jobvora parses it with Gemini into a structured profile (work experience, education, links, summary).
2. **Job discovery** — Jobvora searches for roles via Brave Search, normalizes listings across sources, and lets users save jobs they're interested in.
3. **Applying** — for a saved job, Jobvora detects the application platform (Greenhouse, Lever, Workable, Wellfound, or other), spins up a Browserbase session, and uses Stagehand/Playwright to open the application form.
4. **Field mapping** — required form fields are detected and mapped to the user's profile data; any fields that can't be confidently mapped are flagged for the user to answer.
5. **Submission** — the automation fills and submits the form (pausing for human verification when needed, e.g. CAPTCHAs).

## Contributing

Contributions, issues, and feature requests are welcome. Feel free to open an issue or submit a pull request.

