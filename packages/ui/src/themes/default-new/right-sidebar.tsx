import { cn } from "../../lib/utils"
import { PanelContent } from "./panel-content"
import { usePanelStore } from "./store"
import React from "react"

export interface RightSidebarProps {
  children: React.ReactNode
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ children }) => {
  const { rightContentName, toggleRightContent } = usePanelStore()
  return (
    <div
      className={cn(
        "absolute right-0 top-0 h-full w-80 border-l backdrop-blur ",
        "supports-[backdrop-filter]:bg-background/60 transition-transform duration-300 ease-in-out z-50 shadow-lg",
        !rightContentName && "translate-x-full",
      )}
    >
      <PanelContent title="Documentation" onClose={() => toggleRightContent('docs')} showClose>
        {children}
      </PanelContent>
    </div >
  )
}