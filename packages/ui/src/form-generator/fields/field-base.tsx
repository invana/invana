import React from "react"
import type { Control } from "react-hook-form"
import {
  FormControl,
  FormDescription,
  FormField as FormFieldBase,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ColorSwatches } from "../ui/color-swatches"
import { SliderField } from "./slider-field"
import { IconPreview } from "../ui/icon-preview"
import { ImageField } from "./image-field"
import { GeoField } from "./geo-field"
import { TimeField } from "./time-field"

interface FieldProps {
  label?: string
  description?: string
  placeholder?: string
  value?: any
  onChange?: (value: any) => void
  options?: { label: string; value: string }[]
  min?: number
  max?: number
  step?: number
  presetColors?: Array<{ label: string; value: string; darkValue?: string }>
  defaultValue?: string
  className?: string
  labelPosition?: "side" | "top"
}

export function InputField({ label, description, labelPosition = "side", className, ...props }: FieldProps) {
  const { presetColors, options, min, max, step, defaultValue, ...domProps } = props
  return (
    <FormItem
      className={cn(
        labelPosition === "side" && "grid grid-cols-3 items-center gap-2",
        labelPosition === "top" && "space-y-2",
      )}
    >
      {label && <FormLabel className="text-xs">{label}</FormLabel>}
      <div className={cn(labelPosition === "side" && "col-span-2", "space-y-1")}>
        <FormControl>
          <Input className="h-8 text-sm" {...domProps} />
        </FormControl>
        {description && <FormDescription className="text-xs">{description}</FormDescription>}
        <FormMessage className="text-xs" />
      </div>
    </FormItem>
  )
}

export function SelectField({ label, description, options = [], value, onChange, labelPosition = "side" }: FieldProps) {
  return (
    <FormItem
      className={cn(
        labelPosition === "side" && "grid grid-cols-3 items-center gap-2",
        labelPosition === "top" && "space-y-2",
      )}
    >
      {label && <FormLabel className="text-xs">{label}</FormLabel>}
      <div className={cn(labelPosition === "side" && "col-span-2", "space-y-1")}>
        <Select value={value} onValueChange={onChange}>
          <FormControl>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {description && <FormDescription className="text-xs">{description}</FormDescription>}
        <FormMessage className="text-xs" />
      </div>
    </FormItem>
  )
}

export function BooleanField({ label, description, value, onChange, labelPosition = "side" }: FieldProps) {
  if (labelPosition === "side") {
    return (
      <FormItem className="flex items-center justify-between rounded-md border p-2">
        <div>
          {label && <FormLabel className="text-xs">{label}</FormLabel>}
          {description && <FormDescription className="text-xs">{description}</FormDescription>}
        </div>
        <FormControl>
          <Switch checked={value} onCheckedChange={onChange} />
        </FormControl>
      </FormItem>
    )
  }

  return (
    <FormItem className="space-y-2">
      {label && <FormLabel className="text-xs">{label}</FormLabel>}
      <div className="flex items-center justify-between rounded-md border p-2">
        {description && <FormDescription className="text-xs">{description}</FormDescription>}
        <FormControl>
          <Switch checked={value} onCheckedChange={onChange} />
        </FormControl>
      </div>
    </FormItem>
  )
}

export function ColorField({
  label,
  description,
  value,
  onChange,
  presetColors,
  defaultValue,
  labelPosition = "side",
  className,
  ...domProps
}: FieldProps) {
  return (
    <FormItem
      className={cn(
        labelPosition === "side" && "grid grid-cols-3 items-center gap-2",
        labelPosition === "top" && "space-y-2",
      )}
    >
      {label && <FormLabel className="text-xs">{label}</FormLabel>}
      <div className={cn(labelPosition === "side" && "col-span-2", "space-y-1")}>
        <FormControl>
          <ColorSwatches value={value} onChange={onChange} presetColors={presetColors} defaultValue={defaultValue} />
        </FormControl>
        {description && <FormDescription className="text-xs">{description}</FormDescription>}
        <FormMessage className="text-xs" />
      </div>
    </FormItem>
  )
}

export function NumberField({ label, description, value, onChange, labelPosition = "side", ...props }: FieldProps) {
  return (
    <FormItem
      className={cn(
        labelPosition === "side" && "grid grid-cols-3 items-center gap-2",
        labelPosition === "top" && "space-y-2",
      )}
    >
      {label && <FormLabel className="text-xs">{label}</FormLabel>}
      <div className={cn(labelPosition === "side" && "col-span-2", "space-y-1")}>
        <FormControl>
          <SliderField value={value} onChange={onChange} {...props} />
        </FormControl>
        {description && <FormDescription className="text-xs">{description}</FormDescription>}
        <FormMessage className="text-xs" />
      </div>
    </FormItem>
  )
}

export function IconPreviewField({
  label,
  description,
  value,
  onChange,
  labelPosition = "side",
  className,
  ...props
}: FieldProps) {
  return (
    <FormItem
      className={cn(
        labelPosition === "side" && "grid grid-cols-3 items-center gap-2",
        labelPosition === "top" && "space-y-2",
      )}
    >
      {label && <FormLabel className="text-xs">{label}</FormLabel>}
      <div className={cn(labelPosition === "side" && "col-span-2", "space-y-1")}>
        <FormControl>
          <IconPreview value={value} onChange={onChange} />
        </FormControl>
        {description && <FormDescription className="text-xs">{description}</FormDescription>}
        <FormMessage className="text-xs" />
      </div>
    </FormItem>
  )
}

export function ImagePreviewField({
  label,
  description,
  value,
  onChange,
  labelPosition = "side",
  className,
  ...props
}: FieldProps) {
  return (
    <FormItem
      className={cn(
        labelPosition === "side" && "grid grid-cols-3 items-start gap-2",
        labelPosition === "top" && "space-y-2",
      )}
    >
      {label && <FormLabel className="text-xs">{label}</FormLabel>}
      <div className={cn(labelPosition === "side" && "col-span-2", "space-y-1")}>
        <FormControl>
          <ImageField value={value} onChange={onChange} />
        </FormControl>
        {description && <FormDescription className="text-xs">{description}</FormDescription>}
        <FormMessage className="text-xs" />
      </div>
    </FormItem>
  )
}

export function GeoLocationField({
  label,
  description,
  value,
  onChange,
  labelPosition = "side",
  className,
  ...props
}: FieldProps) {
  return (
    <FormItem
      className={cn(
        labelPosition === "side" && "grid grid-cols-3 items-start gap-2",
        labelPosition === "top" && "space-y-2",
      )}
    >
      {label && <FormLabel className="text-xs">{label}</FormLabel>}
      <div className={cn(labelPosition === "side" && "col-span-2", "space-y-1")}>
        <FormControl>
          <GeoField value={value} onChange={onChange} />
        </FormControl>
        {description && <FormDescription className="text-xs">{description}</FormDescription>}
        <FormMessage className="text-xs" />
      </div>
    </FormItem>
  )
}

export function TimePickerField({
  label,
  description,
  value,
  onChange,
  labelPosition = "side",
  className,
  ...props
}: FieldProps) {
  return (
    <FormItem
      className={cn(
        labelPosition === "side" && "grid grid-cols-3 items-start gap-2",
        labelPosition === "top" && "space-y-2",
      )}
    >
      {label && <FormLabel className="text-xs">{label}</FormLabel>}
      <div className={cn(labelPosition === "side" && "col-span-2", "space-y-1")}>
        <FormControl>
          <TimeField value={value} onChange={onChange} />
        </FormControl>
        {description && <FormDescription className="text-xs">{description}</FormDescription>}
        <FormMessage className="text-xs" />
      </div>
    </FormItem>
  )
}

export const Field = {
  Input: InputField,
  Boolean: BooleanField,
  Color: ColorField,
  Select: SelectField,
  Icon: IconPreviewField,
  Number: NumberField,
  Image: ImagePreviewField,
  Geo: GeoLocationField,
  Time: TimePickerField,
}

