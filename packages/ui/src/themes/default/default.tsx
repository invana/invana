"use client"

import React from "react"
import { LeftNav, LeftNavProps } from "./left-nav"
import { PanelProvider } from "./context/panel-context"
import { AppHeader, AppHeaderProps } from "../app"
import { TooltipProvider } from "@/components/ui"

export interface DefaultLayoutProps {
  headerProps?: AppHeaderProps
  children: React.ReactNode
  leftNavProps?: LeftNavProps
}



export const DefaultLayout: React.FC<DefaultLayoutProps> = ({ children, ...props }) => {

  return (
    <TooltipProvider delayDuration={0}>
      <PanelProvider initialSize={20}>
        <div className="flex min-h-screen  flex-col">
          <AppHeader {...props.headerProps} />
          <div className="flex flex-1">
            <LeftNav {...props.leftNavProps} />
            <main className="flex-1">{children}</main>
          </div>
        </div>
      </PanelProvider>
    </TooltipProvider>
  )
}