import React from "react"
import { Button, ButtonProps } from "../ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip"
import { cn } from "../../lib/utils"


export interface ButtonWithTooltipProps extends ButtonProps {
  tooltip: React.ReactNode
}

export function ButtonWithTooltip(props: ButtonWithTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <Button variant="ghost" className={cn('hover:bg-transparent', props.className)} {...props}>
            {props.children}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {props.tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

