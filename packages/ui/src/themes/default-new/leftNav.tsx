import React from "react"
import { usePanelStore } from "./store"
import { DefaultNewLayoutProps } from "./types"
import { Bell, Settings } from "lucide-react"
import { cn } from "@/lib/utils"


export const LeftNav: React.FC<DefaultNewLayoutProps["leftNavProps"]> = ({ items, activeItem: externalActiveItem, onItemClick }) => {
  const [activeItem, setActiveItem] = React.useState(externalActiveItem ?? items[0]?.label)
  const { toggleLeftContent, toggleRightContent } = usePanelStore()

  const bottomNavItems = [
    { icon: Settings, label: "Settings", href: "#" },
    { icon: Bell, label: "Notifications", href: "#" },
  ]

  return (
    <div className="w-[50px] h-full border-r bg-background flex flex-col items-center py-4">
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => {
            setActiveItem(item.label)
            if (item.toggleSidebar === "query") {
              toggleLeftContent("query")
            } else if (item.toggleSidebar === "docs") {
              toggleRightContent("docs")
            }
            onItemClick?.(item)
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

      <div className="flex-1" />

      {bottomNavItems.map((item) => (
        <button
          key={item.label}
          onClick={() => onItemClick?.(item)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-sm transition-colors hover:bg-accent"
          title={item.label}
        >
          <item.icon className="h-5 w-5" />
          <span className="sr-only">{item.label}</span>
        </button>
      ))}
    </div>
  )
}
