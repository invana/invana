"use client"
import React from "react"
import * as LucideIcons from "lucide-react"
import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

interface IconBrowserProps {
  value?: string
  onChange?: (value: string) => void
  className?: string
}

export function IconBrowser({ value, onChange, className }: IconBrowserProps) {
  const [search, setSearch] = useState("")

  // Filter and memoize icons
  const icons = useMemo(() => {
    // Filter out non-icon exports
    const iconEntries = Object.entries(LucideIcons).filter(
      ([name, component]) =>
        // Ensure it's a valid icon component
        typeof component === "function" &&
        // Exclude utility functions and default export
        name !== "default" &&
        !name.startsWith("create") &&
        name.toLowerCase().includes(search.toLowerCase()),
    )
    return iconEntries
  }, [search])

  return (
    <div className={cn("space-y-2", className)}>
      <Input
        type="search"
        placeholder="Search icons..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8"
      />
      <ScrollArea className="h-[200px] border rounded-md">
        <div className="grid grid-cols-6 gap-2 p-2">
          {icons.map(([name, Icon]) => {
            const isSelected = name === value
            return (
              <button
                key={name}
                onClick={() => onChange?.(name)}
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-md border",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  isSelected && "border-primary bg-primary/10",
                )}
                title={name}
                type="button"
              >
                {/* @ts-ignore - Icon is a valid component */}
                <Icon className="h-5 w-5" />
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/20 rounded-md">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
                <span className="sr-only">Select {name} icon</span>
              </button>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

