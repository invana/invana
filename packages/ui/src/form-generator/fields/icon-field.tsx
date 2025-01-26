"use client"

import { FormControl, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { IconBrowser } from "../ui/icon-browser"
import { cn } from "@/lib/utils"
import * as icons from "lucide-react"
import React from "react"

interface IconFieldProps {
  label?: string
  value?: string
  onChange?: (value: string) => void
  className?: string
  labelPosition?: "side" | "top"
}

export function IconField({ label, value, onChange, className, labelPosition = "side" }: IconFieldProps) {
  // Get the selected icon component
  const SelectedIcon = value ? (icons as any)[value] : null

  return (
    <FormItem
      className={cn(
        labelPosition === "side" && "grid grid-cols-3 items-start gap-2",
        labelPosition === "top" && "space-y-2",
        className,
      )}
    >
      {label && (
        <div className="flex items-center gap-2">
          <FormLabel className="text-xs">{label}</FormLabel>
          {SelectedIcon && <SelectedIcon className="h-4 w-4 text-muted-foreground" />}
        </div>
      )}
      <div className={cn(labelPosition === "side" && "col-span-2")}>
        <FormControl>
          <IconBrowser value={value} onChange={onChange} />
        </FormControl>
        <FormMessage className="text-xs" />
      </div>
    </FormItem>
  )
}

