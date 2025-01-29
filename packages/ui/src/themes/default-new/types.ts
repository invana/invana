import type { LucideIcon } from "lucide-react"
import type React from "react"

export interface NavItem {
  icon: LucideIcon
  label: string
  href: string
  toggleSidebar?: "query" | "docs"
}

export interface LeftNavProps {
  items: NavItem[]
  activeItem?: string
  onItemClick?: (item: NavItem) => void
}

export interface DefaultNewLayoutProps {
  className?: string
  leftNavProps: LeftNavProps
  leftContent: React.ReactNode
  mainContent: React.ReactNode
  rightContent: React.ReactNode
}

