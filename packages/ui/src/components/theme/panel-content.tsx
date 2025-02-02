import { Button } from "../ui/button"
import { X } from "lucide-react"
import React from "react" // Added import for React

interface PanelContentProps {
  title?: React.ReactNode
  header?: React.ReactNode
  children?: React.ReactNode
  className?: string
  onClose?: () => void
  showClose?: boolean
}

export function PanelContent({ title, header, children, onClose, showClose, className }: PanelContentProps) {
  return (
    <div className={` h-full ${className}`}>
      <div className="flex items-center justify-between border-b  px-3 py-0">
        {title && <h3 className="font-semibold">{title}</h3>}
        {header && <>{header}</>}
        {showClose && (
          <Button variant="ghost" size="icon" className="h-8 w-8 relative hover:bg-transparent hover:text-sky-500 right-[-10px]" onClick={onClose}>
            <X className="h-3 w-3" />
            <span className="sr-only">Close panel</span>
          </Button>
        )}
      </div>
      <div className=" overflow-auto px-3 py-0">{children}</div>
    </div>
  )
}

