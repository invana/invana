import React from "react"
import { Moon, Sun } from "lucide-react"
import useTheme from "../../hooks/useTheme"
import { LeftNavItem, LeftNavItems } from "../../components/theme/left-nav-items"
import { Tooltip, TooltipTrigger, Button, TooltipContent } from '../../components/ui';


export interface LeftNavProps {
  topNavItems?: LeftNavItem[];
  bottomNavItems?: LeftNavItem[];
  className?: string,
  showToggleTheme?: boolean
}


export const LeftNav: React.FC<LeftNavProps> = ({ showToggleTheme = false, className = '', topNavItems, bottomNavItems }) => {

  const { theme, initTheme, toggleTheme } = useTheme();
  initTheme();

  return (
    <div className={`w-[45px] h-full  flex flex-col items-center ${className}`}>
      <LeftNavItems items={topNavItems ?? []} />

      <div className="flex-1" />
      <LeftNavItems items={bottomNavItems ?? []} />

      {/* {bottomNavItems.map((item) => (
        <button
          key={item.name}
          onClick={item.onClick}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-sm transition-colors hover:bg-accent"
          title={item.name}
        >
          <item.icon className="h-5 w-5" />
          <span className="sr-only">{item.name}</span>
        </button>
      ))} */}
      {
        showToggleTheme && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="flex h-[50px] w-full px-2 py-2 items-center justify-center
                 rounded-none text-muted-foreground transition-colors 
                 hover:bg-accent hover:text-accent-foreground"
                onClick={toggleTheme}
              >
                {
                  theme === "dark" ? (
                    <Sun className="h-4 w-4 text-foreground" />
                  ) : (
                    <Moon className="h-4 w-4 text-foreground" />
                  )
                }
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle theme</TooltipContent>
          </Tooltip>
        )
      }
    </div>
  )
}
