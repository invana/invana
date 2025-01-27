"use client"

import { Input } from "../../components/ui/input"
import { cn } from "../../lib/utils"
import { Clock } from "lucide-react"

interface TimeFieldProps {
  value?: string
  onChange?: (value: string) => void
  className?: string
}

export function TimeField({ value, onChange, className }: TimeFieldProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Clock className="h-4 w-4 text-muted-foreground" />
      <Input type="time" value={value} onChange={(e) => onChange?.(e.target.value)} className="h-8" />
    </div>
  )
}

