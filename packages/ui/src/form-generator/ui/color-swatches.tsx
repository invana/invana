"use client"
import { cn } from "../../lib/utils"
import { Check } from "lucide-react"
import { useState, useEffect } from "react"
import React from "react";

interface ColorOption {
  label: string
  value: string
  darkValue?: string
}

interface ColorSwatchesProps {
  value?: string
  onChange?: (value: string) => void
  presetColors?: ColorOption[]
  defaultValue?: string
}

export const ColorSwatches: React.FC<ColorSwatchesProps> = ({
  value,
  onChange,
  presetColors = [
    { label: "Black", value: "rgb(0, 0, 0)", darkValue: "rgb(255, 255, 255)" },
    { label: "Red", value: "rgb(239, 68, 68)" },
    { label: "Blue", value: "rgb(59, 130, 246)" },
  ],
  defaultValue = "rgb(0, 0, 0)",
}) => {
  const [customColor, setCustomColor] = useState(value || defaultValue)
  const [isCustom, setIsCustom] = useState(false)

  useEffect(() => {
    if (value) {
      const isPresetColor = presetColors.some((color) => color.value === value)
      setIsCustom(!isPresetColor)
      if (!isPresetColor) {
        setCustomColor(value)
      }
    }
  }, [value, presetColors])

  const handleColorChange = (newColor: string, custom = false) => {
    setIsCustom(custom)
    if (custom) {
      setCustomColor(newColor)
    }
    onChange?.(newColor)
  }

  return (
    <div className="flex gap-2">
      {presetColors.map((color) => (
        <button
          key={color.label}
          className={cn(
            "group relative h-8 w-8 overflow-hidden rounded-md border",
            "ring-offset-background transition-all hover:scale-105",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            !isCustom && value === color.value && "ring-2 ring-ring ring-offset-2",
          )}
          onClick={() => handleColorChange(color.value)}
          type="button"
        >
          <div
            className="h-full w-full"
            style={{
              backgroundColor: color.value,
            }}
          />
          {!isCustom && value === color.value && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Check className="h-4 w-4 text-white" />
            </div>
          )}
          <span className="sr-only">Select {color.label}</span>
        </button>
      ))}

      <div
        className={cn(
          "group relative h-8 w-8 overflow-hidden rounded-md border",
          "ring-offset-background transition-all hover:scale-105",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isCustom && "ring-2 ring-ring ring-offset-2",
        )}
      >
        <input
          type="color"
          value={customColor}
          onChange={(e) => handleColorChange(e.target.value, true)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <div className="h-full w-full" style={{ backgroundColor: customColor }} />
        {isCustom && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Check className="h-4 w-4 text-white" />
          </div>
        )}
        <span className="sr-only">Custom color picker</span>
      </div>
    </div>
  )
}

