"use client"
import React from "react"
import { useState } from "react"
import { Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form"
import { useForm } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { FormField } from "./form-field"
import { FormBuilderConfig } from "./types"

interface FormBuilderProps {
  config: FormBuilderConfig
  onSubmit?: (data: any) => void
  defaultValues?: any
}

export function FormBuilder({ config, onSubmit, defaultValues = {} }: FormBuilderProps) {
  const form = useForm({
    defaultValues,
  })

  const [formData, setFormData] = useState<any>()

  function handleSubmit(data: any) {
    setFormData(data)
    onSubmit?.(data)
  }

  return (
    <div className="container mx-auto p-4">

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:max-h-[800px] lg:overflow-auto">
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
                <button
                  type="submit"
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                >
                  Submit
                </button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="lg:max-h-[800px] lg:overflow-auto">
          <CardHeader className="p-4">
            <CardTitle className="text-lg">Form Data</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">
              {JSON.stringify(formData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

