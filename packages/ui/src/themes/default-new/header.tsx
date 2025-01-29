import { Bell, Search, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import React from "react"
export interface AppHeaderProps {
  left?: React.ReactNode
  center?: React.ReactNode
  right?: React.ReactNode
}

export function Header({ left, center, right }: AppHeaderProps) {
  return (
    <header className="flex h-[50px] items-center border-b border-border bg-background px-4">
      <div className="flex flex-1 items-center gap-4">
        <div className="flex items-center gap-2 text-foreground text-xl">
          {/* header left */}
          {left}
        </div>
        <div className="flex-1 flex justify-center items-center gap-1 sm:gap-2">
          {/* header middle */}
          {center}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {/* header right */}
          {right}
        </div>
      </div>
    </header>
  )
}

