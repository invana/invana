"use client"
import React from "react"
import * as LucideIcons from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover"
import { Input } from "../../components/ui/input"
import { ScrollArea } from "../../components/ui/scroll-area"
import { Check } from "lucide-react"
import { useState, useMemo } from "react"
import { cn } from "../../lib/utils"

interface IconPreviewProps {
  value?: string
  onChange?: (value: string) => void
  className?: string
}

export function IconPreview({ value, onChange, className }: IconPreviewProps) {
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)

  // Get initial icons (first 24)
  const initialIcons = useMemo(() => {
    return Object.entries(LucideIcons)
      .filter(
        ([name, component]) => typeof component === "function" && name !== "default" && !name.startsWith("create"),
      )
      .slice(0, 24)
  }, [])

  // Filter icons based on search
  const filteredIcons = useMemo(() => {
    if (!search) return initialIcons

    return Object.entries(LucideIcons).filter(
      ([name, component]) =>
        typeof component === "function" &&
        name !== "default" &&
        !name.startsWith("create") &&
        name.toLowerCase().includes(search.toLowerCase()),
    )
  }, [search, initialIcons])

  // Get the current icon component
  const SelectedIcon = value ? (LucideIcons as any)[value] : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-8 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm ring-offset-background",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className,
          )}
          onFocus={() => setOpen(true)}
        >
          <span className="truncate">{value || "Select an icon"}</span>
          {SelectedIcon && (
            <div className="ml-auto flex h-5 w-5 items-center justify-center">
              <SelectedIcon className="h-4 w-4" />
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="p-2 space-y-2">
          <Input
            type="search"
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
          <ScrollArea className="h-[300px] pr-4">
            <div className="grid grid-cols-6 gap-2">
              {(search ? filteredIcons : initialIcons).map(([name, Icon]) => {
                const isSelected = name === value
                return (
                  <button
                    key={name}
                    onClick={() => {
                      onChange?.(name)
                      setOpen(false)
                    }}
                    className={cn(
                      "relative flex h-10 w-10 items-center justify-center rounded-md border",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
            {search && filteredIcons.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No icons found for "{search}"</p>
            )}
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  )
}

