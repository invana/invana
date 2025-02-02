"use client"

import { Package, Sun, MonitorSmartphone } from "lucide-react"
import React from "react"
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui"
import useTheme from "@/hooks/useTheme"
import { LeftNavItem, LeftNavItems } from "@/components/theme/left-nav-items"
// const navItems = [
//   { icon: Home, label: "Dashboard", href: "#" },
//   { icon: Users, label: "Users", href: "#" },
//   { icon: Mail, label: "Messages", href: "#" },
//   { icon: BarChart2, label: "Analytics", href: "#" },
//   { icon: Settings, label: "Settings", href: "#" },
// ]

export interface LeftNavProps {
  topNavItems?: LeftNavItem[];
  bottomNavItems?: LeftNavItem[];
}




export const LeftNav: React.FC<LeftNavProps> = ({ topNavItems, bottomNavItems }) => {
  // const [activeItem, setActiveItem] = React.useState("Dashboard")
  // const { sidebar, setSidebar } = usePanel()

  const { theme, initTheme, toggleTheme } = useTheme();
  initTheme();

  // const { sidebar, setSidebar } = usePanel()
  // const topNavItems: LeftNavItem[] = [
  //   // { name: "Home", href: "/", icon: Home },
  //   {
  //     name: "Query Console",
  //     onClick: () => {
  //       console.log("Explorer Clicked")
  //       if (sidebar === 'explorer') {
  //         setSidebar(undefined)
  //       } else {
  //         setSidebar('query')
  //       }
  //     }, icon: Compass
  //   },
  //   // { name: "Modeller", href: "/modeller", icon: Network },
  //   {
  //     name: "Database Connection",
  //     onClick: () => { },
  //     icon: Database
  //   },
  // ]

  // const bottomNavItems: LeftNavItem[] = [
  //   { name: "Activity", href: "/activity", icon: Activity },
  //   { name: "Settings", href: "#", icon: Settings },
  // ]



  return (
    <div className="w-[50px] h-screen border-r bg-background flex flex-col items-center py-4">
      <div className="grid min-h-screen w-full lg:grid-cols-[50px_1fr]">
        <nav className="hidden border-r border-border bg-background lg:block">
          <div className="flex h-[50px] items-center justify-center border-b">
            <a href="#">
              <Package className="h-5 w-5 text-foreground" />
            </a>
          </div>
          <div className="flex flex-col justify-between h-[calc(100vh-50px)]">
            <div className="">
              <LeftNavItems items={topNavItems ?? []} />

            </div>
            <div className="">

              <LeftNavItems items={bottomNavItems ?? []} />

              {/* {bottomNavItems?.map((item) => (
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
              ))} */}
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
                      <MonitorSmartphone className="h-4 w-4 text-foreground" />
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
          {/* {props.children} */}
        </div>
      </div>
    </div>
  )
}

