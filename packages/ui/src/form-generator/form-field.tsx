import React from "react"
import type { Control } from "react-hook-form"
import { FormField as FormFieldBase } from "@/components/ui/form"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Field } from "./fields/field-base"

interface ObjectFieldProps {
  control: Control<any>
  name: string
  fields: Array<{
    name: string
    type: "text" | "number" | "boolean" | "color" | "select" | "icon" | "image" | "geo" | "time"
    label?: string
    description?: string
    placeholder?: string
    options?: { label: string; value: string }[]
    min?: number
    max?: number
    step?: number
    group?: string
    presetColors?: Array<{ label: string; value: string; darkValue?: string }>
    defaultValue?: string
  }>
  rowConfig?: Array<{
    id: string
    fields: string[]
  }>
  labelPosition?: "side" | "top"
}

function ObjectField({ control, name, fields, rowConfig, labelPosition = "side" }: ObjectFieldProps) {
  // Organize fields by groups
  const groupedFields = fields.reduce(
    (acc, field) => {
      const group = field.group || "_ungrouped"
      if (!acc[group]) {
        acc[group] = []
      }
      acc[group].push(field)
      return acc
    },
    {} as Record<string, typeof fields>,
  )

  const renderFields = (fields: typeof ObjectFieldProps.prototype.fields) => {
    if (!rowConfig) {
      // If no row configuration, render fields two per row
      return (
        <div className="grid gap-4">
          {chunk(fields, 2).map((rowFields, index) => (
            <div key={index} className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {rowFields.map((field) => renderField(field))}
            </div>
          ))}
        </div>
      )
    }

    // Get all fields that aren't in any row config
    const configuredFieldNames = rowConfig.flatMap((row) => row.fields)
    const unassignedFields = fields.filter((field) => !configuredFieldNames.includes(field.name))

    return (
      <div className="space-y-4">
        {/* Render configured rows */}
        {rowConfig.map((row) => {
          const rowFields = row.fields
            .map((fieldName) => fields.find((f) => f.name === fieldName))
            .filter((field): field is NonNullable<typeof field> => field !== undefined)

          return chunk(rowFields, 2).map((chunkedFields, chunkIndex) => (
            <div key={`${row.id}-${chunkIndex}`} className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {chunkedFields.map((field) => renderField(field))}
            </div>
          ))
        })}
        {/* Render remaining fields */}
        {unassignedFields.length > 0 && (
          <div className="grid gap-4">
            {chunk(unassignedFields, 2).map((rowFields, index) => (
              <div key={`unassigned-${index}`} className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {rowFields.map((field) => renderField(field))}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderField = (field: ObjectFieldProps["fields"][0]) => (
    <FormFieldBase
      key={field.name}
      control={control}
      name={`${name}.${field.name}`}
      render={({ field: formField }) => {
        const { onChange, value, ref, ...domProps } = formField
        const fieldProps = {
          label: field.label || formatFieldName(field.name),
          description: field.description,
          options: field.options,
          min: field.min,
          max: field.max,
          step: field.step,
          presetColors: field.presetColors,
          defaultValue: field.defaultValue,
          labelPosition: labelPosition,
          onChange,
          value,
        }

        switch (field.type) {
          case "boolean":
            return <Field.Boolean {...fieldProps} />
          case "color":
            return <Field.Color {...fieldProps} />
          case "number":
            return <Field.Number {...fieldProps} />
          case "select":
            return <Field.Select {...fieldProps} />
          case "icon":
            return <Field.Icon {...fieldProps} />
          case "image":
            return <Field.Image {...fieldProps} />
          case "geo":
            return <Field.Geo {...fieldProps} />
          case "time":
            return <Field.Time {...fieldProps} />
          default:
            return (
              <Field.Input {...fieldProps} placeholder={field.placeholder || `Enter ${field.name}`} {...domProps} />
            )
        }
      }}
    />
  )

  const ungroupedFields = groupedFields["_ungrouped"] || []
  delete groupedFields["_ungrouped"]

  return (
    <div className="space-y-6">
      {ungroupedFields.length > 0 && <div className="space-y-4">{renderFields(ungroupedFields)}</div>}

      {Object.entries(groupedFields).length > 0 && (
        <Accordion type="multiple" className="w-full space-y-2">
          {Object.entries(groupedFields).map(([group, fields]) => (
            <AccordionItem key={group} value={group} className="border rounded-md">
              <AccordionTrigger className="px-3 text-sm">{formatFieldName(group)} Settings</AccordionTrigger>
              <AccordionContent className="px-3 pb-3">
                <div className="space-y-4">{renderFields(fields)}</div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  )
}

function formatFieldName(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

function chunk<T>(array: T[], size: number): T[][] {
  return array.reduce((acc, _, i) => {
    if (i % size === 0) {
      acc.push(array.slice(i, i + size))
    }
    return acc
  }, [] as T[][])
}

export const FormField = Object.assign(FormFieldBase, {
  ...Field,
  ObjectField,
})

