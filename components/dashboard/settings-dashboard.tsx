"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  Camera,
  Check,
  CreditCard,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  Trash2,
} from "lucide-react"

import { removeAvatarAction, updateAccountSettingsAction, uploadAvatarAction } from "@/app/actions/profile"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type SettingsInitialData = {
  name: string
  email: string
  phone: string
  avatarUrl: string | null
  planName: string
  accountStatus: string
}

export function SettingsDashboard({
  initialData,
}: {
  initialData: SettingsInitialData
}) {
  const router = useRouter()
  const [name, setName] = React.useState(initialData.name)
  const [phone, setPhone] = React.useState(initialData.phone)
  const [avatarUrl, setAvatarUrl] = React.useState(initialData.avatarUrl)
  const [saving, setSaving] = React.useState(false)
  const [photoPending, setPhotoPending] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [message, setMessage] = React.useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  const initials = React.useMemo(() => {
    const candidate = name.trim() || initialData.email || "U"
    return (
      candidate
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "U"
    )
  }, [name, initialData.email])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const result = await updateAccountSettingsAction({
        fullName: name,
        phone,
      })

      if (!result.success) {
        setMessage({ type: "error", text: result.error })
        return
      }

      setMessage({ type: "success", text: "Account settings saved." })
      router.refresh()
    } catch {
      setMessage({
        type: "error",
        text: "Could not save your account settings right now.",
      })
    } finally {
      setSaving(false)
    }
  }

  const uploadPhoto = async (file: File) => {
    setPhotoPending(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.set("avatar", file)
      const result = await uploadAvatarAction(formData)
      if (!result.success) {
        setMessage({ type: "error", text: result.error })
        return
      }
      setAvatarUrl(result.avatarUrl)
      setMessage({ type: "success", text: "Profile photo updated." })
      router.refresh()
    } catch {
      setMessage({ type: "error", text: "Could not upload your profile photo." })
    } finally {
      setPhotoPending(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const removePhoto = async () => {
    setPhotoPending(true)
    setMessage(null)
    try {
      const result = await removeAvatarAction()
      if (!result.success) {
        setMessage({ type: "error", text: result.error })
        return
      }
      setAvatarUrl(null)
      setMessage({ type: "success", text: "Profile photo removed." })
      router.refresh()
    } catch {
      setMessage({ type: "error", text: "Could not remove your profile photo." })
    } finally {
      setPhotoPending(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Profile Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account information, billing, and profile picture.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2 xl:items-stretch">
        <Card className="h-full shadow-sm">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Update the account details associated with Jobvora.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <Avatar size="lg" className="size-16 border border-border bg-[#EDF9FD]">
                  {avatarUrl ? (
                    <AvatarImage
                      src={avatarUrl}
                      alt={name || "Profile photo"}
                    />
                  ) : null}
                  <AvatarFallback className="bg-[#EDF9FD] text-lg font-medium text-slate-800">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div>
                  <p className="text-sm font-medium text-foreground">
                    Profile picture
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG, or WebP. Maximum file size: 2MB.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadPhoto(file) }} />
                <Button type="button" variant="outline" size="sm" disabled={photoPending} onClick={() => fileInputRef.current?.click()}>
                  {photoPending ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                  Change photo
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!avatarUrl || photoPending}
                  onClick={() => void removePhoto()}
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="settings-name">Name</Label>
                <Input
                  id="settings-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="settings-email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="settings-email"
                    type="email"
                    value={initialData.email}
                    readOnly
                    className="pl-9 bg-muted/40 text-muted-foreground"
                  />
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="settings-phone">Phone number</Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="settings-phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="(555) 123-4567"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            {message ? (
              <div
                className={
                  message.type === "success"
                    ? "flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                    : "flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                }
              >
                {message.type === "success" ? (
                  <Check className="size-4" />
                ) : (
                  <AlertCircle className="size-4" />
                )}
                <span>{message.text}</span>
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="min-w-[150px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full shadow-sm">
            <CardHeader>
              <CardTitle>Billing & Subscription</CardTitle>
              <CardDescription>
                Manage your plan, AI application limits, and payment details.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col space-y-4">
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-600">
                  Current plan
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {initialData.planName}
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border bg-background p-3">
                <div>
                  <p className="text-sm font-medium">Account status</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {initialData.accountStatus.replace(/_/g, " ")}
                  </p>
                </div>
                <ShieldCheck className="size-4 text-emerald-600" />
              </div>

              <Button
                type="button"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => router.push("/dashboard/billing")}
              >
                <CreditCard className="size-4" />
                Manage billing
              </Button>
              <div className="mt-auto border-t pt-4">
                <SignOutButton />
              </div>
            </CardContent>
        </Card>
      </div>
    </main>
  )
}
