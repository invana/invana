import type React from "react"
import { AppHeaderProps } from "../app"
import { LeftNavProps } from "./left-nav"

// export interface NavItem {
//   icon: LucideIcon
//   label: string
//   href: string
//   toggleSidebar?: "query" | "docs"
// }



export interface DefaultV2LayoutProps {
  className?: string
  leftNavProps: LeftNavProps
  rightNavProps: LeftNavProps
  headerProps: AppHeaderProps


  leftContent: React.ReactNode
  mainTopContent: React.ReactNode
  mainBottomContent: React.ReactNode
  rightContent: React.ReactNode
}

