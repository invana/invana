"use client"
import React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

const colorOptions = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
  { name: "Gray", value: "#6b7280" },
  { name: "Black", value: "#000000" },
]

interface ColorPickerProps {
  value?: string | number
  onChange?: (value: string) => void
}

export function ColorPicker({ value = "#000000", onChange }: ColorPickerProps) {
  const [color, setColor] = useState(value.toString())

  const handleChange = (newColor: string) => {
    setColor(newColor)
    onChange?.(newColor)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn("h-8 w-full rounded-md border border-input px-2", "flex items-center gap-2")}>
          <div className="h-5 w-5 rounded-md border" style={{ backgroundColor: color }} />
          <span className="text-xs">{color}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-2">
          {colorOptions.map((option) => (
            <div key={option.value} className="flex items-center justify-between space-x-2">
              <div className="flex items-center space-x-2">
                <div className="h-4 w-4 rounded-sm border" style={{ backgroundColor: option.value }} />
                <Label className="text-xs">{option.name}</Label>
              </div>
              <Switch checked={color === option.value} onCheckedChange={() => handleChange(option.value)} />
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

