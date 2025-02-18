"use client"

import { useEffect, useRef, useState } from "react"
import { Command, Pin, Search } from "lucide-react"

import { useCommandStore } from "./store"



import {
  Calculator,
  Calendar,
  CreditCard,
  Settings,
  User,
  Mail,
  MessageSquare,
  PlusCircle,
  UserPlus,
  Users,
} from "lucide-react"
import { cn } from "@invana/ui/lib/utils"
import { Input, CommandList, CommandGroup, CommandItem, Button, CommandSeparator, CommandEmpty } from "@invana/ui"

export const commands = [
  {
    id: "calendar",
    label: "Calendar",
    icon: Calendar,
    shortcut: ["⌘", "C"],
    action: () => console.log("Opening calendar..."),
  },
  {
    id: "calculator",
    label: "Calculator",
    icon: Calculator,
    shortcut: ["⌘", "K"],
    action: () => console.log("Opening calculator..."),
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    shortcut: ["⌘", ","],
    action: () => console.log("Opening settings..."),
  },
  {
    id: "profile",
    label: "Profile",
    icon: User,
    action: () => console.log("Opening profile..."),
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
    action: () => console.log("Opening billing..."),
  },
  {
    id: "mail",
    label: "Mail",
    icon: Mail,
    action: () => console.log("Opening mail..."),
  },
  {
    id: "messages",
    label: "Messages",
    icon: MessageSquare,
    action: () => console.log("Opening messages..."),
  },
  {
    id: "new-project",
    label: "New Project",
    icon: PlusCircle,
    action: () => console.log("Creating new project..."),
  },
  {
    id: "invite-team",
    label: "Invite Team Members",
    icon: UserPlus,
    action: () => console.log("Inviting team members..."),
  },
  {
    id: "team",
    label: "Team",
    icon: Users,
    action: () => console.log("Opening team settings..."),
  },
]



export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const commandListRef = useRef<HTMLDivElement>(null)
  const { pinnedItems, recentItems, togglePin, addRecent } = useCommandStore()

  // Filter commands based on search
  const filteredCommands = commands.filter((command) => command.label.toLowerCase().includes(search.toLowerCase()))

  // Get pinned commands
  const pinnedCommands = commands.filter((command) => pinnedItems.includes(command.id))

  // Get recent commands
  const recentCommands = commands.filter((command) => recentItems.includes(command.id))

  // Handle keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(!open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [open])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        commandListRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        !commandListRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const runCommand = async (command: (typeof commands)[0]) => {
    await command.action()
    addRecent(command.id)
    setOpen(false)
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Search commands... (⌘K)"
          className="pl-8 pr-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
        />
        <kbd className="pointer-events-none absolute right-2 top-2.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </div>

      {open && (
        <div ref={commandListRef} className="absolute mt-2 w-full rounded-xl border bg-popover shadow-md">
          <Command className="rounded-lg">
            <CommandList className="max-h-[500px] overflow-y-auto">
              <div className="flex">
                {/* Left side - Pinned and Recent */}
                <div className="w-64 border-r min-h-[300px]">
                  {pinnedCommands.length > 0 && (
                    <CommandGroup heading="Pinned">
                      {pinnedCommands.map((command) => {
                        const Icon = command.icon
                        return (
                          <CommandItem key={command.id} onSelect={() => runCommand(command)}>
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                <span>{command.label}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                }}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  togglePin(command.id)
                                }}
                              >
                                <Pin className={cn("h-3 w-3", pinnedItems.includes(command.id) && "fill-current")} />
                              </Button>
                            </div>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  )}

                  {recentCommands.length > 0 && (
                    <>
                      <CommandSeparator />
                      <CommandGroup heading="Recent">
                        {recentCommands.map((command) => {
                          const Icon = command.icon
                          return (
                            <CommandItem key={command.id} onSelect={() => runCommand(command)}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                <span>{command.label}</span>
                              </div>
                            </CommandItem>
                          )
                        })}
                      </CommandGroup>
                    </>
                  )}
                </div>

                {/* Right side - All Commands */}
                <div className="flex-1">
                  <CommandEmpty>No results found.</CommandEmpty>
                  <CommandGroup heading="All Commands">
                    {filteredCommands.map((command) => {
                      const Icon = command.icon
                      return (
                        <CommandItem key={command.id} onSelect={() => runCommand(command)}>
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <span>{command.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {command.shortcut && (
                                <div className="flex items-center gap-1">
                                  {command.shortcut.map((key, i) => (
                                    <kbd
                                      key={i}
                                      className="pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground"
                                    >
                                      {key}
                                    </kbd>
                                  ))}
                                </div>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                }}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  togglePin(command.id)
                                }}
                              >
                                <Pin className={cn("h-3 w-3", pinnedItems.includes(command.id) && "fill-current")} />
                              </Button>
                            </div>
                          </div>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </div>
              </div>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  )
}

