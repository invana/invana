"use client"

import { useState } from "react"
import { Input } from "../../components/ui/input"
import { cn } from "../../lib/utils"
import { ImageIcon, X } from "lucide-react"
import React from "react"

interface ImageFieldProps {
  value?: string
  onChange?: (value: string) => void
  className?: string
}

export function ImageField({ value, onChange, className }: ImageFieldProps) {
  const [preview, setPreview] = useState(value)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        setPreview(result)
        onChange?.(result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleClear = () => {
    setPreview(undefined)
    onChange?.("")
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Input type="file" accept="image/*" onChange={handleChange} className="h-8" />
        {preview && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md p-1 hover:bg-muted"
            aria-label="Clear image"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {preview ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-md border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview || "/placeholder.svg"} alt="Preview" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-md border bg-muted">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
    </div>
  )
}

