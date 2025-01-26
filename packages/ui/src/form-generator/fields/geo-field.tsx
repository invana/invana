"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { MapPin } from "lucide-react"
import React from "react"

interface GeoFieldProps {
  value?: { lat: number; lng: number }
  onChange?: (value: { lat: number; lng: number }) => void
  className?: string
}

export function GeoField({ value, onChange, className }: GeoFieldProps) {
  const [coordinates, setCoordinates] = useState(value || { lat: 0, lng: 0 })

  const handleLatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const lat = Number(e.target.value)
    const newCoordinates = { ...coordinates, lat }
    setCoordinates(newCoordinates)
    onChange?.(newCoordinates)
  }

  const handleLngChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const lng = Number(e.target.value)
    const newCoordinates = { ...coordinates, lng }
    setCoordinates(newCoordinates)
    onChange?.(newCoordinates)
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <div className="grid flex-1 gap-2 sm:grid-cols-2">
          <Input
            type="number"
            placeholder="Latitude"
            value={coordinates.lat}
            onChange={handleLatChange}
            className="h-8"
            step="any"
            min="-90"
            max="90"
          />
          <Input
            type="number"
            placeholder="Longitude"
            value={coordinates.lng}
            onChange={handleLngChange}
            className="h-8"
            step="any"
            min="-180"
            max="180"
          />
        </div>
      </div>
    </div>
  )
}

