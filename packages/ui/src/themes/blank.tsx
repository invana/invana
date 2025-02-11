import { Moon, Package, Sun, } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip"
import { Separator } from "../components/ui/separator"
import { Button } from "../components/ui"
import useTheme from "../hooks/useTheme"
import React from "react"
import { LeftNavItem } from '@/components/theme/left-nav-items'



export interface BlankLayoutProps {
  children: React.ReactNode;
  logo: React.ReactNode;
  topNavItems?: LeftNavItem[];
  bottomNavItems?: LeftNavItem[];
}


export const BlankLayout: React.FC<BlankLayoutProps> = (props) => {

  const { theme, initTheme, toggleTheme } = useTheme();
  initTheme();

  return (
    <TooltipProvider delayDuration={0}>
      <div className="grid min-h-screen w-full lg:grid-cols-[50px_1fr]">
        <nav className="hidden border-r border-border bg-background lg:block">
          <div className="flex h-[50px] items-center justify-center border-b">
            <a href="/">
              <Package className="h-5 w-5 text-foreground" />
            </a>
          </div>
          <div className="flex flex-col justify-between h-[calc(100vh-50px)]">
            <div className="">
              {props.topNavItems?.map((item) => (
                <React.Fragment key={item.name}>
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>
                      {item.href ? (
                        <a
                          href={item.href}
                          className="flex h-[50px] w-full items-center justify-center 
                      text-muted-foreground transition-colors 
                      hover:bg-accent hover:text-accent-foreground px-2 py-2"
                        >
                          <item.icon className="h-5 w-5" />
                          {/* <p className="text-xss">{item.name}</p> */}
                        </a>
                      ) : item.onClick ? (
                        <button
                          onClick={item.onClick}
                          className="flex h-[50px] w-full items-center justify-center 
                      text-muted-foreground transition-colors 
                      hover:bg-accent hover:text-accent-foreground px-2 py-2"
                        >
                          <item.icon className="h-5 w-5" />
                        </button>
                      ) : (
                        <div
                          className="flex h-[50px] w-full items-center justify-center 
                      text-muted-foreground transition-colors 
                      hover:bg-accent hover:text-accent-foreground px-2 py-2"
                        >
                          <item.icon className="h-5 w-5" />
                        </div>
                      )}
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                  {item.showSeperator && <Separator />}
                </React.Fragment>

              ))}
            </div>
            <div className="">
              {props.bottomNavItems?.map((item) => (
                <Tooltip key={item.name}>
                  <TooltipTrigger asChild>
                    <a
                      href={item.href}
                      className="flex h-[50px] w-full px-2 py-2 items-center justify-center 
                      text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="sr-only">{item.name}</span>
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {item.name}
                  </TooltipContent>
                </Tooltip>
              ))}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex h-[50px] w-full px-2 py-2 items-center justify-center rounded-none
                      text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    onClick={toggleTheme}
                  >
                    {theme === "dark" ? (
                      <Sun className="h-4 w-4 text-foreground" />
                    ) : (
                      <Moon className="h-4 w-4 text-foreground" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle theme</TooltipContent>
              </Tooltip>
            </div>
          </div>
          {/* <div className="border-t">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-[50px] w-full justify-center rounded-none p-0 transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src="/placeholder-user.jpg" alt="User" />
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                  <span className="sr-only">User Profile</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                John Doe
                <br />
                <span className="text-xs text-muted-foreground">john@example.com</span>
              </TooltipContent>
            </Tooltip>
          </div> */}
        </nav>
        <div className="flex flex-col">
          {props.children}
        </div>
      </div>
    </TooltipProvider>
  )
}

