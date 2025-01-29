"use client"

import React from "react"
import { LeftNav } from "./left-nav"
import { PanelProvider, usePanel } from "./context/panel-context"
import { AppHeader } from "../app"
import { TooltipProvider } from "@/components/ui"
import { SideBarNavitemProps } from "../blank"
import { Network } from "inspector"
import { Home, Compass, Database, Activity, Settings } from "lucide-react"


interface LayoutProps {
  children: React.ReactNode
}

export const DefaultLayout: React.FC<LayoutProps> = ({ children }: LayoutProps) => {



  return (
    <TooltipProvider delayDuration={0}>
      <PanelProvider initialSize={20}>
        <div className="flex min-h-screen  flex-col">
          <AppHeader
            left={<span>Logo</span>}
            center={<span>Center</span>}
            right={<span>Right</span>}
          />
          <div className="flex flex-1">
            <LeftNav />
            <main className="flex-1">{children}</main>
          </div>
        </div>
      </PanelProvider>
    </TooltipProvider>
  )
}