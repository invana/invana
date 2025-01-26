"use client"
import React from "react"
import { useState } from "react"
import { Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form"
import { useForm } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { FormField } from "./form-field"
import { FormBuilderConfig } from "./types"
import { Button } from "@/components/ui"
import { cn } from "@/lib/utils"

interface FormBuilderProps {
  config: FormBuilderConfig
  onSubmit?: (data: any) => void
  defaultValues?: any
  className?: string
  showReset?: boolean
}

export function SimpleFormGenerator({ config, onSubmit, defaultValues = {},
  className, showReset = false }: FormBuilderProps) {
  const form = useForm({
    defaultValues,
  })

  const [formData, setFormData] = useState<any>()

  function handleSubmit(data: any) {
    setFormData(data)
    onSubmit?.(data)
  }

  function handleReset() {
    form.reset(defaultValues)
    setFormData(undefined)
  }

  return (
    // <div className="container mx-auto p-4">
    //   <div className="grid gap-4 lg:grid-cols-2">
    <Card className={cn("lg:overflow-auto", className)}>
      <CardHeader className="p-4">
        {config.title && <CardTitle className="text-lg">{config.title}</CardTitle>}
        {config.description && <CardDescription>{config.description}</CardDescription>}
      </CardHeader>
      <CardContent className="p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField.ObjectField
              control={form.control}
              name=""
              fields={config.fields}
              rowConfig={config.rowConfig}
              labelPosition={config.labelPosition}
            />
            <div className="flex gap-2">
              <Button type="submit" className="">
                Submit
              </Button>
              {showReset && (
                <Button type="button" variant="outline" onClick={handleReset} className="ml-3">
                  Reset
                </Button>
              )}

            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
    //   </div>
    // </div>
  )
}

