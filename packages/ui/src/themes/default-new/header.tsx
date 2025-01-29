import React from "react"

export interface AppHeaderProps {
  left?: React.ReactNode
  center?: React.ReactNode
  right?: React.ReactNode
}

export const Header: React.FC<AppHeaderProps> = ({ left, center, right }) => {
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

