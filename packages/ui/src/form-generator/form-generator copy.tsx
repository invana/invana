"use client"

import { useState } from "react"
import { Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form"
import { useForm } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FormField } from "./form-field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ICanvasNodeDisplay } from "@invana/data-store"
import React from "react"

interface FormGeneratorProps {
  labelPosition?: "side" | "top";
  className?: string
}

const shapeTypes = [
  { label: "Circle", value: "circle" },
  { label: "Rectangle", value: "rectangle" },
  { label: "Diamond", value: "diamond" },
  { label: "Triangle", value: "triangle" },
  { label: "Hexagon", value: "hexagon" },
]

const fieldTypes = [
  { label: "Text", value: "text" },
  { label: "Number", value: "number" },
  { label: "Boolean", value: "boolean" },
  { label: "Color", value: "color" },
  { label: "Select", value: "select" },
  { label: "Icon", value: "icon" },
  { label: "Image", value: "image" },
  { label: "Geo Location", value: "geo" },
  { label: "Time", value: "time" },
]

export function FormGenerator({ labelPosition = "side", className = 'w-[320px]' }: FormGeneratorProps) {
  const form = useForm<ICanvasNodeDisplay>({
    defaultValues: {
      shape: {
        type: "circle",
      },
      label: {},
      labelField: "",
    },
  })

  const [formData, setFormData] = useState<ICanvasNodeDisplay>()

  function onSubmit(data: ICanvasNodeDisplay) {
    setFormData(data)
    console.log("Form submitted:", data)
  }

  const shapeFields = [
    {
      name: "type",
      type: "select",
      options: shapeTypes,
      group: "general",
      row: "basic",
    },
    {
      name: "size",
      type: "number",
      min: 0,
      max: 500,
      step: 1,
      group: "general",
      row: "basic",
    },
    {
      name: "animated",
      type: "boolean",
      group: "general",
      row: "basic",
    },
    {
      name: "bgColor",
      type: "color",
      group: "background",
      row: "bg-main",
      presetColors: [
        { label: "White", value: "#ffffff" },
        { label: "Gray", value: "#f3f4f6" },
        { label: "Primary", value: "#3b82f6" },
      ],
      defaultValue: "#ffffff",
    },
    {
      name: "bgOpacity",
      type: "number",
      min: 0,
      max: 1,
      step: 0.1,
      group: "background",
      row: "bg-main",
    },
    {
      name: "bgPadding",
      type: "number",
      min: 0,
      max: 50,
      step: 1,
      group: "background",
      row: "bg-main",
    },
    {
      name: "borderColor",
      type: "color",
      group: "border",
      row: "border-main",
      presetColors: [
        { label: "White", value: "#ffffff" },
        { label: "Gray", value: "#f3f4f6" },
        { label: "Primary", value: "#3b82f6" },
      ],
      defaultValue: "#ffffff",
    },
    {
      name: "BorderWidth",
      type: "number",
      min: 0,
      max: 20,
      step: 1,
      group: "border",
      row: "border-main",
    },
    {
      name: "borderRadius",
      type: "number",
      min: 0,
      max: 50,
      step: 1,
      group: "border",
      row: "border-main",
    },
    {
      name: "dottedBorder",
      type: "boolean",
      group: "border",
      row: "border-main",
    },
    {
      name: "dottedBorderSpacing",
      type: "number",
      min: 0,
      max: 20,
      step: 1,
      group: "border",
      row: "border-main",
    },
    {
      name: "iconFontFamily",
      type: "text",
      group: "icon",
      row: "icon-main",
    },
    {
      name: "iconCode",
      type: "icon",
      group: "icon",
      row: "icon-main",
    },
    {
      name: "iconColor",
      type: "color",
      group: "icon",
      row: "icon-main",
      presetColors: [
        { label: "White", value: "#ffffff" },
        { label: "Gray", value: "#f3f4f6" },
        { label: "Primary", value: "#3b82f6" },
      ],
      defaultValue: "#ffffff",
    },
    {
      name: "iconSize",
      type: "number",
      min: 0,
      max: 100,
      step: 1,
      group: "icon",
      row: "icon-main",
    },
    {
      name: "iconOpacity",
      type: "number",
      min: 0,
      max: 1,
      step: 0.1,
      group: "icon",
      row: "icon-main",
    },
    {
      name: "iconRotate",
      type: "number",
      min: 0,
      max: 360,
      step: 1,
      group: "icon",
      row: "icon-main",
    },
  ]

  const labelFields = [
    {
      name: "bgColor",
      type: "color",
      group: "background",
      row: "bg-main",
      presetColors: [
        { label: "White", value: "#ffffff" },
        { label: "Gray", value: "#f3f4f6" },
        { label: "Primary", value: "#3b82f6" },
      ],
      defaultValue: "#ffffff",
    },
    {
      name: "bgOpacity",
      type: "number",
      min: 0,
      max: 1,
      step: 0.1,
      group: "background",
      row: "bg-main",
    },
    {
      name: "bgPadding",
      type: "number",
      min: 0,
      max: 50,
      step: 1,
      group: "background",
      row: "bg-main",
    },
    {
      name: "borderColor",
      type: "color",
      group: "border",
      row: "border-main",
      presetColors: [
        { label: "White", value: "#ffffff" },
        { label: "Gray", value: "#f3f4f6" },
        { label: "Primary", value: "#3b82f6" },
      ],
      defaultValue: "#ffffff",
    },
    {
      name: "BorderWidth",
      type: "number",
      min: 0,
      max: 20,
      step: 1,
      group: "border",
      row: "border-main",
    },
    {
      name: "borderRadius",
      type: "number",
      min: 0,
      max: 50,
      step: 1,
      group: "border",
      row: "border-main",
    },
    {
      name: "dottedBorder",
      type: "boolean",
      group: "border",
      row: "border-main",
    },
    {
      name: "dottedBorderSpacing",
      type: "number",
      min: 0,
      max: 20,
      step: 1,
      group: "border",
      row: "border-main",
    },
    {
      name: "textColor",
      type: "color",
      group: "text",
      row: "text-main",
      presetColors: [
        { label: "White", value: "#ffffff" },
        { label: "Gray", value: "#f3f4f6" },
        { label: "Primary", value: "#3b82f6" },
      ],
      defaultValue: "#000000",
    },
    {
      name: "textFontSize",
      type: "number",
      min: 8,
      max: 72,
      step: 1,
      group: "text",
      row: "text-main",
    },
    {
      name: "textFontWeight",
      type: "text",
      group: "text",
      row: "text-main",
    },
    {
      name: "textFontFamily",
      type: "text",
      group: "text",
      row: "text-main",
    },
    {
      name: "textOpacity",
      type: "number",
      min: 0,
      max: 1,
      step: 0.1,
      group: "text",
      row: "text-main",
    },
  ]

  const shapeRowConfig = [
    {
      id: "general-basic-1",
      fields: ["type", "size"],
    },
    {
      id: "general-basic-2",
      fields: ["animated"],
    },
    {
      id: "background-main-1",
      fields: ["bgColor", "bgOpacity"],
    },
    {
      id: "background-main-2",
      fields: ["bgPadding"],
    },
    {
      id: "border-main-1",
      fields: ["borderColor", "BorderWidth"],
    },
    {
      id: "border-main-2",
      fields: ["borderRadius", "dottedBorder"],
    },
    {
      id: "border-main-3",
      fields: ["dottedBorderSpacing"],
    },
    {
      id: "icon-main-1",
      fields: ["iconCode", "iconSize"],
    },
    {
      id: "icon-main-2",
      fields: ["iconOpacity", "iconRotate"],
    },
  ]

  const labelRowConfig = [
    {
      id: "background-main-1",
      fields: ["bgColor", "bgOpacity"],
    },
    {
      id: "background-main-2",
      fields: ["bgPadding"],
    },
    {
      id: "border-main-1",
      fields: ["borderColor", "BorderWidth"],
    },
    {
      id: "border-main-2",
      fields: ["borderRadius", "dottedBorder"],
    },
    {
      id: "text-main-1",
      fields: ["textColor", "textFontSize"],
    },
    {
      id: "text-main-2",
      fields: ["textOpacity", "textFontWeight"],
    },
  ]

  return (
    <div className={"container mx-auto p-4 " + className}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:max-h-[800px] lg:overflow-auto">
          <CardHeader className="p-4">
            <CardTitle className="text-lg">Canvas Node Configuration</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="labelField"
                  render={({ field }) => (
                    <FormField.Select
                      label="Label Field Type"
                      options={fieldTypes}
                      placeholder="Select field type"
                      labelPosition={labelPosition}
                      {...field}
                    />
                  )}
                />

                <Tabs defaultValue="shape" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="shape">Shape</TabsTrigger>
                    <TabsTrigger value="label">Label</TabsTrigger>
                  </TabsList>
                  <TabsContent value="shape" className="mt-2">
                    <FormField.ObjectField
                      control={form.control}
                      name="shape"
                      fields={shapeFields}
                      rowConfig={shapeRowConfig}
                      labelPosition={labelPosition}
                    />
                  </TabsContent>
                  <TabsContent value="label" className="mt-2">
                    <FormField.ObjectField
                      control={form.control}
                      name="label"
                      fields={labelFields}
                      rowConfig={labelRowConfig}
                      labelPosition={labelPosition}
                    />
                  </TabsContent>
                </Tabs>

                <button
                  type="submit"
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                >
                  Generate Configuration
                </button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="lg:max-h-[800px] lg:overflow-auto">
          <CardHeader className="p-4">
            <CardTitle className="text-lg">Generated Configuration</CardTitle>
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

