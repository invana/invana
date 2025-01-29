"use client"

import * as React from "react"

type SidebarType = "query" | undefined

interface PanelContextType {
  navSize: number
  setNavSize: (size: number) => void
  sidebar: SidebarType
  setSidebar: (type: SidebarType) => void
}

const PanelContext = React.createContext<PanelContextType | undefined>(undefined)

export function PanelProvider({
  children,
  initialSize = 20,
}: {
  children: React.ReactNode
  initialSize?: number
}) {
  const [navSize, setNavSize] = React.useState(initialSize)
  const [sidebar, setSidebar] = React.useState<SidebarType>(undefined)

  return (
    <PanelContext.Provider
      value={{
        navSize,
        setNavSize,
        sidebar,
        setSidebar,
      }}
    >
      {children}
    </PanelContext.Provider>
  )
}

export function usePanel() {
  const context = React.useContext(PanelContext)
  if (context === undefined) {
    throw new Error("usePanel must be used within a PanelProvider")
  }
  return context
}

