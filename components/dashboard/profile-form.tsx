"use client"

import * as React from "react"
import {
  Award,
  Briefcase,
  CheckCircle2,
  FileText,
  FolderKanban,
  GraduationCap,
  Link2,
  Plus,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ProfileCompletenessCard,
  type CompletenessSection,
} from "@/components/dashboard/profile-completeness-card"
import { updateProfileAction } from "@/app/actions/profile"
import type { ParsedResume } from "@/lib/resume/schema"

type WithKey<T> = T & { _key: string }

type FormState = {
  fullName: string
  headline: string
  email: string
  phone: string
  location: string
  summary: string
  skills: string[]
  links: WithKey<{ label: string; url: string }>[]
  workExperience: WithKey<{
    company: string
    title: string
    location: string
    startDate: string
    endDate: string
    isCurrent: boolean
    description: string
    bullets: string[]
  }>[]
  education: WithKey<{
    institution: string
    degree: string
    fieldOfStudy: string
    startDate: string
    endDate: string
    description: string
  }>[]
  projects: WithKey<{
    name: string
    description: string
    techStack: string[]
    link: string
  }>[]
  certifications: WithKey<{
    name: string
    issuer: string
    issueDate: string
    credentialUrl: string
  }>[]
}

let keyCounter = 0
function nextKey() {
  keyCounter += 1
  return `row-${keyCounter}`
}

function toFormState(data: ParsedResume): FormState {
  return {
    fullName: data.fullName ?? "",
    headline: data.headline ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    location: data.location ?? "",
    summary: data.summary ?? "",
    skills: data.skills,
    links: data.links.map((item) => ({ ...item, _key: nextKey() })),
    workExperience: data.workExperience.map((item) => ({
      company: item.company,
      title: item.title,
      location: item.location ?? "",
      startDate: item.startDate ?? "",
      endDate: item.endDate ?? "",
      isCurrent: item.isCurrent,
      description: item.description ?? "",
      bullets: item.bullets,
      _key: nextKey(),
    })),
    education: data.education.map((item) => ({
      institution: item.institution,
      degree: item.degree ?? "",
      fieldOfStudy: item.fieldOfStudy ?? "",
      startDate: item.startDate ?? "",
      endDate: item.endDate ?? "",
      description: item.description ?? "",
      _key: nextKey(),
    })),
    projects: data.projects.map((item) => ({
      name: item.name,
      description: item.description ?? "",
      techStack: item.techStack,
      link: item.link ?? "",
      _key: nextKey(),
    })),
    certifications: data.certifications.map((item) => ({
      name: item.name,
      issuer: item.issuer ?? "",
      issueDate: item.issueDate ?? "",
      credentialUrl: item.credentialUrl ?? "",
      _key: nextKey(),
    })),
  }
}

function blankOrNull(value: string) {
  return value.trim() === "" ? null : value.trim()
}

function toSubmission(form: FormState) {
  return {
    fullName: blankOrNull(form.fullName),
    headline: blankOrNull(form.headline),
    email: blankOrNull(form.email),
    phone: blankOrNull(form.phone),
    location: blankOrNull(form.location),
    summary: blankOrNull(form.summary),
    skills: form.skills,
    links: form.links
      .filter((l) => l.label.trim() && l.url.trim())
      .map(({ label, url }) => ({ label, url })),
    workExperience: form.workExperience
      .filter((w) => w.company.trim() || w.title.trim())
      .map((w) => ({
        company: w.company,
        title: w.title,
        location: blankOrNull(w.location),
        startDate: blankOrNull(w.startDate),
        endDate: blankOrNull(w.endDate),
        isCurrent: w.isCurrent,
        description: blankOrNull(w.description),
        bullets: w.bullets.filter((b) => b.trim()),
      })),
    education: form.education
      .filter((e) => e.institution.trim())
      .map((e) => ({
        institution: e.institution,
        degree: blankOrNull(e.degree),
        fieldOfStudy: blankOrNull(e.fieldOfStudy),
        startDate: blankOrNull(e.startDate),
        endDate: blankOrNull(e.endDate),
        description: blankOrNull(e.description),
      })),
    projects: form.projects
      .filter((p) => p.name.trim())
      .map((p) => ({
        name: p.name,
        description: blankOrNull(p.description),
        techStack: p.techStack.filter((t) => t.trim()),
        link: blankOrNull(p.link),
      })),
    certifications: form.certifications
      .filter((c) => c.name.trim())
      .map((c) => ({
        name: c.name,
        issuer: blankOrNull(c.issuer),
        issueDate: blankOrNull(c.issueDate),
        credentialUrl: blankOrNull(c.credentialUrl),
      })),
  }
}

function Row({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

export function ProfileForm({ initialData }: { initialData: ParsedResume }) {
  const [form, setForm] = React.useState<FormState>(() =>
    toFormState(initialData)
  )
  const [skillInput, setSkillInput] = React.useState("")
  const [isPending, startTransition] = React.useTransition()
  const [message, setMessage] = React.useState<
    { type: "success" | "error"; text: string } | null
  >(null)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleAddSkill() {
    const value = skillInput.trim()
    if (!value) return
    if (!form.skills.includes(value)) {
      update("skills", [...form.skills, value])
    }
    setSkillInput("")
  }

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const result = await updateProfileAction(toSubmission(form))
      if (result.success) {
        setMessage({ type: "success", text: "Profile saved." })
      } else {
        setMessage({ type: "error", text: result.error })
      }
    })
  }

  const completenessSections: CompletenessSection[] = React.useMemo(() => {
    const clamp = (count: number, target: number) =>
      Math.min(100, (count / target) * 100)

    const basicFieldsFilled = [
      form.fullName,
      form.headline,
      form.email,
      form.phone,
      form.location,
    ].filter((v) => v.trim()).length

    return [
      {
        key: "basic",
        label: "Basic info",
        icon: <User className="size-3" />,
        percent: clamp(basicFieldsFilled, 5),
      },
      {
        key: "summary",
        label: "Summary",
        icon: <FileText className="size-3" />,
        percent: clamp(form.summary.trim().length, 120),
      },
      {
        key: "skills",
        label: "Skills",
        icon: <Sparkles className="size-3" />,
        percent: clamp(form.skills.length, 6),
      },
      {
        key: "work",
        label: "Work experience",
        icon: <Briefcase className="size-3" />,
        percent: clamp(
          form.workExperience.filter((w) => w.company.trim()).length,
          2
        ),
      },
      {
        key: "education",
        label: "Education",
        icon: <GraduationCap className="size-3" />,
        percent: clamp(
          form.education.filter((e) => e.institution.trim()).length,
          1
        ),
      },
      {
        key: "links",
        label: "Links",
        icon: <Link2 className="size-3" />,
        percent: clamp(form.links.filter((l) => l.url.trim()).length, 2),
      },
      {
        key: "other",
        label: "Projects & certifications",
        icon: <FolderKanban className="size-3" />,
        percent: clamp(
          form.projects.filter((p) => p.name.trim()).length +
            form.certifications.filter((c) => c.name.trim()).length,
          2
        ),
      },
    ]
  }, [form])

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr] lg:items-start">
      <ProfileCompletenessCard
        sections={completenessSections}
        className="lg:sticky lg:top-20"
      />

      <div className="space-y-6 rounded-4xl border bg-card p-6 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
        <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">
            <User /> Profile
          </TabsTrigger>
          <TabsTrigger value="skills">
            <Sparkles /> Skills
          </TabsTrigger>
          <TabsTrigger value="work">
            <Briefcase /> Work Exp
          </TabsTrigger>
          <TabsTrigger value="education">
            <GraduationCap /> Education
          </TabsTrigger>
          <TabsTrigger value="other">
            <FolderKanban /> Other
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Row label="Full name">
              <Input
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                placeholder="Aman Kumar"
              />
            </Row>
            <Row label="Headline">
              <Input
                value={form.headline}
                onChange={(e) => update("headline", e.target.value)}
                placeholder="Full Stack Developer"
              />
            </Row>
            <Row label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="you@example.com"
              />
            </Row>
            <Row label="Phone">
              <Input
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="+91 98765 43210"
              />
            </Row>
            <Row label="Location" className="sm:col-span-2">
              <Input
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                placeholder="Bengaluru, India"
              />
            </Row>
          </div>

          <Row label="Professional summary">
            <Textarea
              value={form.summary}
              onChange={(e) => update("summary", e.target.value)}
              placeholder="A short summary of your experience and strengths…"
              rows={4}
            />
          </Row>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Links</Label>
            {form.links.map((link) => (
              <div key={link._key} className="flex gap-2">
                <Input
                  value={link.label}
                  onChange={(e) =>
                    update(
                      "links",
                      form.links.map((l) =>
                        l._key === link._key
                          ? { ...l, label: e.target.value }
                          : l
                      )
                    )
                  }
                  placeholder="LinkedIn"
                  className="w-36 shrink-0"
                />
                <Input
                  value={link.url}
                  onChange={(e) =>
                    update(
                      "links",
                      form.links.map((l) =>
                        l._key === link._key
                          ? { ...l, url: e.target.value }
                          : l
                      )
                    )
                  }
                  placeholder="https://linkedin.com/in/…"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() =>
                    update(
                      "links",
                      form.links.filter((l) => l._key !== link._key)
                    )
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                update("links", [
                  ...form.links,
                  { label: "", url: "", _key: nextKey() },
                ])
              }
            >
              <Plus /> Add link
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="skills" className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleAddSkill()
                }
              }}
              placeholder="Type a skill and press Enter"
            />
            <Button type="button" variant="outline" onClick={handleAddSkill}>
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.skills.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No skills added yet.
              </p>
            )}
            {form.skills.map((skill) => (
              <Badge key={skill} variant="secondary" className="gap-1 pr-1">
                {skill}
                <button
                  type="button"
                  onClick={() =>
                    update(
                      "skills",
                      form.skills.filter((s) => s !== skill)
                    )
                  }
                  className="rounded-full p-0.5 hover:bg-foreground/10"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="work" className="space-y-4">
          {form.workExperience.map((item) => (
            <Card key={item._key} className="space-y-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Row label="Company">
                  <Input
                    value={item.company}
                    onChange={(e) =>
                      update(
                        "workExperience",
                        form.workExperience.map((w) =>
                          w._key === item._key
                            ? { ...w, company: e.target.value }
                            : w
                        )
                      )
                    }
                  />
                </Row>
                <Row label="Title">
                  <Input
                    value={item.title}
                    onChange={(e) =>
                      update(
                        "workExperience",
                        form.workExperience.map((w) =>
                          w._key === item._key
                            ? { ...w, title: e.target.value }
                            : w
                        )
                      )
                    }
                  />
                </Row>
                <Row label="Location">
                  <Input
                    value={item.location}
                    onChange={(e) =>
                      update(
                        "workExperience",
                        form.workExperience.map((w) =>
                          w._key === item._key
                            ? { ...w, location: e.target.value }
                            : w
                        )
                      )
                    }
                  />
                </Row>
                <div className="grid grid-cols-2 gap-3">
                  <Row label="Start date">
                    <Input
                      value={item.startDate}
                      onChange={(e) =>
                        update(
                          "workExperience",
                          form.workExperience.map((w) =>
                            w._key === item._key
                              ? { ...w, startDate: e.target.value }
                              : w
                          )
                        )
                      }
                      placeholder="Jan 2022"
                    />
                  </Row>
                  <Row label="End date">
                    <Input
                      value={item.isCurrent ? "Present" : item.endDate}
                      disabled={item.isCurrent}
                      onChange={(e) =>
                        update(
                          "workExperience",
                          form.workExperience.map((w) =>
                            w._key === item._key
                              ? { ...w, endDate: e.target.value }
                              : w
                          )
                        )
                      }
                      placeholder="Present"
                    />
                  </Row>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={item.isCurrent}
                  onChange={(e) =>
                    update(
                      "workExperience",
                      form.workExperience.map((w) =>
                        w._key === item._key
                          ? { ...w, isCurrent: e.target.checked }
                          : w
                      )
                    )
                  }
                  className="size-4 rounded border-input"
                />
                I currently work here
              </label>

              <Row label="Description / bullet points (one per line)">
                <Textarea
                  value={item.bullets.join("\n")}
                  onChange={(e) =>
                    update(
                      "workExperience",
                      form.workExperience.map((w) =>
                        w._key === item._key
                          ? { ...w, bullets: e.target.value.split("\n") }
                          : w
                      )
                    )
                  }
                  rows={4}
                  placeholder={"Led migration to microservices\nMentored 3 junior engineers"}
                />
              </Row>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() =>
                  update(
                    "workExperience",
                    form.workExperience.filter((w) => w._key !== item._key)
                  )
                }
              >
                <Trash2 /> Remove
              </Button>
            </Card>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              update("workExperience", [
                ...form.workExperience,
                {
                  company: "",
                  title: "",
                  location: "",
                  startDate: "",
                  endDate: "",
                  isCurrent: false,
                  description: "",
                  bullets: [],
                  _key: nextKey(),
                },
              ])
            }
          >
            <Plus /> Add work experience
          </Button>
        </TabsContent>

        <TabsContent value="education" className="space-y-4">
          {form.education.map((item) => (
            <Card key={item._key} className="space-y-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Row label="Institution">
                  <Input
                    value={item.institution}
                    onChange={(e) =>
                      update(
                        "education",
                        form.education.map((ed) =>
                          ed._key === item._key
                            ? { ...ed, institution: e.target.value }
                            : ed
                        )
                      )
                    }
                  />
                </Row>
                <Row label="Degree">
                  <Input
                    value={item.degree}
                    onChange={(e) =>
                      update(
                        "education",
                        form.education.map((ed) =>
                          ed._key === item._key
                            ? { ...ed, degree: e.target.value }
                            : ed
                        )
                      )
                    }
                  />
                </Row>
                <Row label="Field of study">
                  <Input
                    value={item.fieldOfStudy}
                    onChange={(e) =>
                      update(
                        "education",
                        form.education.map((ed) =>
                          ed._key === item._key
                            ? { ...ed, fieldOfStudy: e.target.value }
                            : ed
                        )
                      )
                    }
                  />
                </Row>
                <div className="grid grid-cols-2 gap-3">
                  <Row label="Start date">
                    <Input
                      value={item.startDate}
                      onChange={(e) =>
                        update(
                          "education",
                          form.education.map((ed) =>
                            ed._key === item._key
                              ? { ...ed, startDate: e.target.value }
                              : ed
                          )
                        )
                      }
                    />
                  </Row>
                  <Row label="End date">
                    <Input
                      value={item.endDate}
                      onChange={(e) =>
                        update(
                          "education",
                          form.education.map((ed) =>
                            ed._key === item._key
                              ? { ...ed, endDate: e.target.value }
                              : ed
                          )
                        )
                      }
                    />
                  </Row>
                </div>
              </div>
              <Row label="Description">
                <Textarea
                  value={item.description}
                  onChange={(e) =>
                    update(
                      "education",
                      form.education.map((ed) =>
                        ed._key === item._key
                          ? { ...ed, description: e.target.value }
                          : ed
                      )
                    )
                  }
                  rows={3}
                />
              </Row>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() =>
                  update(
                    "education",
                    form.education.filter((ed) => ed._key !== item._key)
                  )
                }
              >
                <Trash2 /> Remove
              </Button>
            </Card>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              update("education", [
                ...form.education,
                {
                  institution: "",
                  degree: "",
                  fieldOfStudy: "",
                  startDate: "",
                  endDate: "",
                  description: "",
                  _key: nextKey(),
                },
              ])
            }
          >
            <Plus /> Add education
          </Button>
        </TabsContent>

        <TabsContent value="other" className="space-y-6">
          <div className="space-y-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <FolderKanban className="size-4 text-muted-foreground" />
              Projects
            </h3>
            {form.projects.map((item) => (
              <Card key={item._key} className="space-y-3 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Row label="Project name">
                    <Input
                      value={item.name}
                      onChange={(e) =>
                        update(
                          "projects",
                          form.projects.map((p) =>
                            p._key === item._key
                              ? { ...p, name: e.target.value }
                              : p
                          )
                        )
                      }
                    />
                  </Row>
                  <Row label="Link">
                    <Input
                      value={item.link}
                      onChange={(e) =>
                        update(
                          "projects",
                          form.projects.map((p) =>
                            p._key === item._key
                              ? { ...p, link: e.target.value }
                              : p
                          )
                        )
                      }
                    />
                  </Row>
                </div>
                <Row label="Description">
                  <Textarea
                    value={item.description}
                    onChange={(e) =>
                      update(
                        "projects",
                        form.projects.map((p) =>
                          p._key === item._key
                            ? { ...p, description: e.target.value }
                            : p
                        )
                      )
                    }
                    rows={3}
                  />
                </Row>
                <Row label="Tech stack (comma separated)">
                  <Input
                    value={item.techStack.join(", ")}
                    onChange={(e) =>
                      update(
                        "projects",
                        form.projects.map((p) =>
                          p._key === item._key
                            ? {
                                ...p,
                                techStack: e.target.value
                                  .split(",")
                                  .map((t) => t.trim()),
                              }
                            : p
                        )
                      )
                    }
                    placeholder="React, Node.js, PostgreSQL"
                  />
                </Row>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() =>
                    update(
                      "projects",
                      form.projects.filter((p) => p._key !== item._key)
                    )
                  }
                >
                  <Trash2 /> Remove
                </Button>
              </Card>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                update("projects", [
                  ...form.projects,
                  {
                    name: "",
                    description: "",
                    techStack: [],
                    link: "",
                    _key: nextKey(),
                  },
                ])
              }
            >
              <Plus /> Add project
            </Button>
          </div>

          <div className="space-y-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Award className="size-4 text-muted-foreground" />
              Certifications
            </h3>
            {form.certifications.map((item) => (
              <Card key={item._key} className="space-y-3 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Row label="Name">
                    <Input
                      value={item.name}
                      onChange={(e) =>
                        update(
                          "certifications",
                          form.certifications.map((c) =>
                            c._key === item._key
                              ? { ...c, name: e.target.value }
                              : c
                          )
                        )
                      }
                    />
                  </Row>
                  <Row label="Issuer">
                    <Input
                      value={item.issuer}
                      onChange={(e) =>
                        update(
                          "certifications",
                          form.certifications.map((c) =>
                            c._key === item._key
                              ? { ...c, issuer: e.target.value }
                              : c
                          )
                        )
                      }
                    />
                  </Row>
                  <Row label="Issue date">
                    <Input
                      value={item.issueDate}
                      onChange={(e) =>
                        update(
                          "certifications",
                          form.certifications.map((c) =>
                            c._key === item._key
                              ? { ...c, issueDate: e.target.value }
                              : c
                          )
                        )
                      }
                    />
                  </Row>
                  <Row label="Credential URL">
                    <Input
                      value={item.credentialUrl}
                      onChange={(e) =>
                        update(
                          "certifications",
                          form.certifications.map((c) =>
                            c._key === item._key
                              ? { ...c, credentialUrl: e.target.value }
                              : c
                          )
                        )
                      }
                    />
                  </Row>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() =>
                    update(
                      "certifications",
                      form.certifications.filter((c) => c._key !== item._key)
                    )
                  }
                >
                  <Trash2 /> Remove
                </Button>
              </Card>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                update("certifications", [
                  ...form.certifications,
                  {
                    name: "",
                    issuer: "",
                    issueDate: "",
                    credentialUrl: "",
                    _key: nextKey(),
                  },
                ])
              }
            >
              <Plus /> Add certification
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-0 -mx-6 flex items-center justify-between gap-3 border-t bg-card/95 px-6 py-4 backdrop-blur-sm">
        <div className="text-sm">
          {message?.type === "success" && (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" /> {message.text}
            </span>
          )}
          {message?.type === "error" && (
            <span className="text-destructive">{message.text}</span>
          )}
        </div>
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        </div>
      </div>
    </div>
  )
}
