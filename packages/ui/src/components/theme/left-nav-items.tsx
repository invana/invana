import React from "react"
import { Tooltip, TooltipTrigger, TooltipContent, Separator } from "../ui"
import type { LucideIcon } from "lucide-react"


export interface LeftNavItem {
  name: string
  href?: string
  onClick?: () => void
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
                className={`flex h-[45px] w-full items-center justify-center 
              text-muted-foreground transition-colors 
                hover:text-accent-foreground px-2 py-2
              ${activeItem === item.name ? 'bg-accent text-accent-foreground' : ''}`}
              >
                <item.icon className="h-5 w-5" />
              </a>
            ) : item.onClick ? (
              <button
                onClick={() => {
                  if (item.onClick) item.onClick();
                  setActiveItem(item.name === activeItem ? null : item.name)
                }}
                className={`flex h-[45px] w-full items-center justify-center 
          text-muted-foreground transition-colors 
          hover:bg-accent  hover:text-sky-500 px-2 py-2
          ${activeItem === item.name ? 'bg-accent text-sky-500' : ''}`}
              >
                <item.icon className="h-5 w-5" />
              </button>
            ) : (
              <div
                className={`flex h-[45px] w-full items-center justify-center 
          text-muted-foreground transition-colors 
            hover:text-accent-foreground px-2 py-2
          ${activeItem === item.name ? 'bg-accent text-accent-foreground' : ''}`}
              >
                <item.icon className="h-5 w-5" />
              </div>
            )}
          </TooltipTrigger>
          <TooltipContent side="right">
            {item.name}
          </TooltipContent>
        </Tooltip>
        <Separator />
      </React.Fragment>

    ))
  }
  </>

}