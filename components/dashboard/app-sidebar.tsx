"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Briefcase,
  Bookmark,
  ChevronsUpDown,
  CreditCard,
  FileText,
  ListChecks,
  LogOut,
  Settings,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"

const navItems = [
  { title: "Jobs", url: "/dashboard/jobs", icon: Briefcase },
  { title: "Saved Jobs", url: "/dashboard/saved-jobs", icon: Bookmark },
  { title: "Resume", url: "/dashboard/resume", icon: FileText },
  { title: "Profile", url: "/dashboard/profile", icon: UserRound },
  { title: "Application Status", url: "/dashboard/status", icon: ListChecks },
]

type SidebarUser = {
  name: string
  email: string
  avatarUrl?: string | null
}

export function AppSidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="cursor-default hover:bg-transparent active:bg-transparent"
              render={<Link href="/dashboard" />}
            >
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold tracking-tight">
                  Jobvora
                </span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  AI Job Agent
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  pathname === item.url || pathname.startsWith(item.url + "/")
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.title}
                      render={<Link href={item.url} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <CreditsCard />
        <SidebarSeparator className="my-0.5" />
        <UserMenu user={user} />
        <SignOutMenuButton />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function CreditsCard() {
  const { state, isMobile } = useSidebar()
  const collapsed = state === "collapsed" && !isMobile

  const creditsUsed = 68
  const creditsTotal = 100

  if (collapsed) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip={`${creditsTotal - creditsUsed} credits left`}
            render={<Link href="/dashboard/billing" />}
          >
            <Zap />
            <span>Credits</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <Link
      href="/dashboard/billing"
      className={cn(
        "group/credits flex flex-col gap-2.5 rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-3",
        "transition-colors hover:bg-sidebar-accent"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-sidebar-foreground">
          <Zap className="size-3.5 text-sidebar-accent-foreground" />
          Billing &amp; Credits
        </div>
        <CreditCard className="size-3.5 text-sidebar-foreground/50 transition-transform group-hover/credits:translate-x-0.5" />
      </div>

      <div className="space-y-1.5">
        <Progress
          value={(creditsUsed / creditsTotal) * 100}
          className="[&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-sidebar-border [&_[data-slot=progress-indicator]]:bg-sidebar-accent-foreground"
        />
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold tabular-nums text-sidebar-foreground">
            {creditsTotal - creditsUsed}
            <span className="ml-1 text-xs font-normal text-sidebar-foreground/60">
              credits left
            </span>
          </span>
          <span className="text-[11px] text-sidebar-foreground/50">
            {creditsUsed}/{creditsTotal}
          </span>
        </div>
      </div>
    </Link>
  )
}

function UserMenu({ user }: { user: SidebarUser }) {
  const { isMobile } = useSidebar()

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
              />
            }
          >
            <Avatar size="sm" className="rounded-xl">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={user.name} />
              ) : null}
              <AvatarFallback className="rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
                {initials || <UserRound className="size-3.5" />}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left leading-tight">
              <span className="truncate text-sm font-medium">
                {user.name}
              </span>
              <span className="truncate text-xs text-sidebar-foreground/60">
                {user.email}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto size-4 text-sidebar-foreground/50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
            className="min-w-64"
          >
            <div className="flex flex-col px-3 py-2 leading-tight">
              <span className="truncate text-sm font-medium text-foreground">
                {user.name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/dashboard/settings" />}>
              <Settings />
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/dashboard/billing" />}>
              <CreditCard />
              Billing &amp; Credits
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function SignOutMenuButton() {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = React.useState(false)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="Sign out"
          disabled={isSigningOut}
          onClick={handleSignOut}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/10 active:text-destructive"
        >
          <LogOut />
          <span>{isSigningOut ? "Signing out…" : "Sign out"}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
