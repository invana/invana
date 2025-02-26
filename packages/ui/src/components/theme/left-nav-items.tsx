import React from "react"
import { Tooltip, TooltipTrigger, TooltipContent, Separator, Button } from "../ui"
import type { LucideIcon } from "lucide-react"


export interface LeftNavItem {
  key?: string
  name: string
  href?: string
  onClick?: () => void
  className?: string;
  activeClass?: string
  iconClassName?: string;
  iconStroke?: number;
  tooltipSide?: 'left' | 'right'
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
                className={` flex border-0 items-center justify-center 
              transition-colors rounded-md
              hover:bg-accenthover:text-sky-500 px-2 py-2 ${item.className || ''}
              ${activeItem === item.name ? 'bg-accent text-accent-foreground' : ''}`}
              >
                <item.icon strokeWidth={item.iconStroke ? item.iconStroke : 2} className={item.iconClassName ? item.iconClassName : "w-5 h-5"} />
              </a>
            ) : item.onClick ? (
              <Button
                size="nav-icon"
                variant={"ghost"}
                onClick={() => {
                  if (item.onClick) item.onClick();
                  setActiveItem(item.name === activeItem ? null : item.name)
                }}
                className={`${item.className || ''}
          ${activeItem === item.name ? `text-sky-500 ${item?.activeClass || ''}` : ''}`}
              >
                <item.icon strokeWidth={item.iconStroke ? item.iconStroke : 2} className={item.iconClassName ? item.iconClassName : "w-5 h-5"} />
              </Button>
            ) : (
              <div
                className={` flex border-0  items-center justify-center 
          transition-colors  rounded-md
            hover:text-accent-foreground px-2 py-2 ${item.className || ''}
          ${activeItem === item.name ? 'bg-accent text-accent-foreground' : ''}`}
              >
                <item.icon strokeWidth={item.iconStroke ? item.iconStroke : 2} className={item.iconClassName ? item.iconClassName : "w-5 h-5"} />
              </div>
            )}
          </TooltipTrigger>
          <TooltipContent side={item.tooltipSide ? item.tooltipSide : 'right'}>
            {item.name}
          </TooltipContent>
        </Tooltip>
        {item.showSeperator && <Separator />}
      </React.Fragment>

    ))
  }
  </>

}