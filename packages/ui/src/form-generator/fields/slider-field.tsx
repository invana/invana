"use client"

import { Slider } from "../../components/ui/slider"
import { Input } from "../../components/ui/input"
import { useState } from "react"
import { cn } from "@/lib/utils"
import React from "react"

interface SliderFieldProps {
  value?: number
  onChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
}

export const SliderField: React.FC<SliderFieldProps> = ({ value = 0, onChange, min = 0,
  max = 100, step = 1, className }) => {
  const [localValue, setLocalValue] = useState(value)

  const handleChange = (newValue: number) => {
    setLocalValue(newValue)
    onChange?.(newValue)
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Slider
        value={[localValue]}
        onValueChange={([newValue]) => handleChange(newValue)}
        max={max}
        min={min}
        step={step}
        className="flex-1"
      />
      <Input
        type="number"
        value={localValue}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="w-16 h-8"
        min={min}
        max={max}
        step={step}
      />
    </div>
  )
}

