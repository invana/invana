import type React from "react"
import { AppHeaderProps } from "../app"
import { LeftNavProps } from "./left-nav"

// export interface NavItem {
//   icon: LucideIcon
//   label: string
//   href: string
//   toggleSidebar?: "query" | "docs"
// }



export interface DefaultNewLayoutProps {
  className?: string
  leftNavProps: LeftNavProps
  headerProps: AppHeaderProps


  leftContent: React.ReactNode
  mainContent: React.ReactNode
  rightContent: React.ReactNode
}

