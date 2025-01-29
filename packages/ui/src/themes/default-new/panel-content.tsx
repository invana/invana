import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import React from "react" // Added import for React

interface PanelContentProps {
  title: React.ReactNode
  children?: React.ReactNode
  onClose?: () => void
  showClose?: boolean
}

export function PanelContent({ title, children, onClose, showClose }: PanelContentProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b   px-3 py-1">
        <h3 className="font-semibold">{title}</h3>
        {showClose && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-3 w-3" />
            <span className="sr-only">Close panel</span>
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-auto p-3">{children}</div>
    </div>
  )
}

