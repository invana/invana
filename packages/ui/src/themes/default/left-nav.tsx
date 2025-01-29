"use client"

import * as React from "react"
import { Home, Settings, Users, BarChart2, Mail } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePanel } from "./context/panel-context"

const navItems = [
  { icon: Home, label: "Dashboard", href: "#" },
  { icon: Users, label: "Users", href: "#" },
  { icon: Mail, label: "Messages", href: "#" },
  { icon: BarChart2, label: "Analytics", href: "#" },
  { icon: Settings, label: "Settings", href: "#" },
]

export function LeftNav() {
  const [activeItem, setActiveItem] = React.useState("Dashboard")
  const { sidebar, setSidebar } = usePanel()

  return (
    <div className="w-[50px] h-screen border-r bg-background flex flex-col items-center py-4">
      {navItems.map((item) => (
        <button
          key={item.label}
          onClick={() => {
            setActiveItem(item.label)
            // Toggle query sidebar when clicking the Dashboard/Home icon
            if (item.label === "Dashboard") {
              setSidebar(sidebar === "query" ? undefined : "query")
            }
          }}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg text-sm transition-colors hover:bg-accent",
            activeItem === item.label && "bg-accent",
          )}
          title={item.label}
        >
          <item.icon className="h-5 w-5" />
          <span className="sr-only">{item.label}</span>
        </button>
      ))}
    </div>
  )
}

