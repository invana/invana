import { Button } from "../ui/button"
import { X } from "lucide-react"
import React from "react" // Added import for React
import { Card, CardHeader, CardContent } from "@invana/ui"

interface PanelContentProps {
  title?: React.ReactNode
  // header?: React.ReactNode
  children?: React.ReactNode
  headerClassName?: string
  bodyClassName?: string
  onClose?: () => void
  showClose?: boolean
}

export function PanelContent({ title, children, onClose, showClose,
  headerClassName, bodyClassName }: PanelContentProps) {
  return (
    <Card className={` h-full  ${headerClassName}`}>
      <CardHeader className="relative py-1 border-b">
        {title && <h4 className="font-semibold  ">{title}</h4>}
        {showClose && (
          <Button variant="ghost" size="icon" className="absolute right-0 top-[-5px]  h-8 w-8 hover:bg-transparent hover:text-sky-500" onClick={onClose}>
            <X className="h-3 w-3" />
            <span className="sr-only">Close panel</span>
          </Button>
        )}
      </CardHeader>
      {/* <div className="flex items-center justify-between border-b  px-3 py-0">
        {header && <>{header}</>}

      </div> */}
      <CardContent className={`overflow-y-auto h-full ${bodyClassName}`}>
        {children}
      </CardContent>
    </Card>
  )
}

