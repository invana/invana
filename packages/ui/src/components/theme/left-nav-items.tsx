import React from "react"
import { Tooltip, TooltipTrigger, TooltipContent, Separator } from "../ui"
import type { LucideIcon } from "lucide-react"


export interface LeftNavItem {
  name: string
  href?: string
  onClick?: () => void
  className?: string;
  iconClassName?: string;
  iconStroke?: number;
  showSeperator?: boolean
  icon: React.ElementType | LucideIcon
  tooltip?: React.ReactNode
}


export const LeftNavItems: React.FC<{ items: LeftNavItem[] }> = ({ items }) => {

  const [activeItem, setActiveItem] = React.useState<null | string>(null)

  return <>{
    items.map((item) => (
      <React.Fragment key={item.name}>
        <Tooltip key={item.name}>
          <TooltipTrigger asChild>
            {item.href ? (
              <a
                href={item.href}
                onClick={() => setActiveItem(item.name)}
                className={`flex border-0 items-center justify-center 
              text-muted-foreground transition-colors
                hover:text-accent-foreground px-2 py-2 ${item.className || ''}
              ${activeItem === item.name ? 'bg-accent text-accent-foreground' : ''}`}
              >
                <item.icon strokeWidth={item.iconStroke ? item.iconStroke : 2} className={item.iconClassName ? item.iconClassName : "h-4 w-4"} />
              </a>
            ) : item.onClick ? (
              <button
                onClick={() => {
                  if (item.onClick) item.onClick();
                  setActiveItem(item.name === activeItem ? null : item.name)
                }}
                className={`flex border-0   items-center justify-center 
          text-muted-foreground transition-colors 
          hover:bg-accent  hover:text-sky-500 px-2 py-2  ${item.className || ''}
          ${activeItem === item.name ? ' text-sky-500' : ''}`}
              >
                <item.icon strokeWidth={item.iconStroke ? item.iconStroke : 2} className={item.iconClassName ? item.iconClassName : "h-4 w-4"} />
              </button>
            ) : (
              <div
                className={`flex border-0  items-center justify-center 
          text-muted-foreground transition-colors 
            hover:text-accent-foreground px-2 py-2 ${item.className || ''}
          ${activeItem === item.name ? 'bg-accent text-accent-foreground' : ''}`}
              >
                <item.icon strokeWidth={item.iconStroke ? item.iconStroke : 2} className={item.iconClassName ? item.iconClassName : "h-4 w-4"} />
              </div>
            )}
          </TooltipTrigger>
          <TooltipContent side="right">
            {item.name}
          </TooltipContent>
        </Tooltip>
        {item.showSeperator && <Separator />}
      </React.Fragment>

    ))
  }
  </>

}