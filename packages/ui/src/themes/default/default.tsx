"use client"

import React from "react"
import { Header } from "./header"
import { LeftNav } from "./left-nav"
import { PanelProvider } from "./context/panel-context"


interface LayoutProps {
  children: React.ReactNode
}

export function DefaultLayout({ children }: LayoutProps) {
  return (
    <PanelProvider initialSize={20}>
      <div className="flex min-h-screen  flex-col">
        <Header />
        <div className="flex flex-1">
          <LeftNav />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </PanelProvider>
  )
}