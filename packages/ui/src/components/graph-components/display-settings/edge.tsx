"use client"
import React from "react"
import { useState } from "react"
import { Form } from "../../../components/ui/form"
import { useForm } from "react-hook-form"
import { Card, CardContent } from "../../../components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs"
import { ICanvasEdgeDisplay } from "@invana/data-store"
import { cn } from "../../../lib/utils"
import { FormField } from "../../../form-generator/form-field"
import { Button } from "../../../components/ui"



export interface EdgeDisplaySettingsProps {
  onSubmit?: (data: ICanvasEdgeDisplay) => void
  defaultValues: ICanvasEdgeDisplay;
  propertyKeys: string[];
  labelPosition?: "side" | "top";
  className?: string;
  showReset?: boolean;
}

const shapeTypes = [
  { label: "Circle", value: "circle" },
  { label: "Rectangle", value: "rectangle" },
  { label: "Diamond", value: "diamond" },
  { label: "Triangle", value: "triangle" },
  { label: "Hexagon", value: "hexagon" },
]

// const fieldTypes = [
//   { label: "Text", value: "text" },
//   { label: "Number", value: "number" },
//   { label: "Boolean", value: "boolean" },
//   { label: "Color", value: "color" },
//   { label: "Select", value: "select" },
//   { label: "Icon", value: "icon" },
//   { label: "Image", value: "image" },
//   { label: "Geo Location", value: "geo" },
//   { label: "Time", value: "time" },
// ]

export function EdgeDisplaySettings({ showReset = false,
  propertyKeys = [],
  defaultValues = {},
  labelPosition = "top", className = 'w-[420px]', ...props }: EdgeDisplaySettingsProps) {
  const form = useForm<ICanvasEdgeDisplay>({
    defaultValues: defaultValues
  })

  // const [formData, setFormData] = useState<ICanvasEdgeDisplay>()

  function onSubmit(data: ICanvasEdgeDisplay) {
    // setFormData(data)
    props.onSubmit?.(data)
    console.log("Form submitted:", data)
  }

  function handleReset() {
    form.reset(defaultValues)
    // setFormData(undefined)
  }


  const shapeFields = [
    {
      name: "strokeColor",
      type: "color" as const,
      group: "stroke",
      presetColors: [
        { label: "Black", value: "#000000" },
        { label: "Gray", value: "#6b7280" },
        { label: "Primary", value: "#3b82f6" },
      ],
    },
    {
      name: "strokeWidth",
      type: "number" as const,
      min: 0,
      max: 20,
      step: 1,
      group: "stroke",
    },
    {
      name: "strokeOpacity",
      type: "number" as const,
      min: 0,
      max: 1,
      step: 0.1,
      group: "stroke",
    },
    {
      name: "strokeArrowheadSize",
      type: "text" as const,
      group: "arrowhead",
    },
    {
      name: "strokeArrowheadColor",
      type: "color" as const,
      group: "arrowhead",
      presetColors: [
        { label: "Black", value: "#000000" },
        { label: "Gray", value: "#6b7280" },
        { label: "Primary", value: "#3b82f6" },
      ],
    },
    {
      name: "strokeArrowheadOpacity",
      type: "number" as const,
      min: 0,
      max: 1,
      step: 0.1,
      group: "arrowhead",
    },
    {
      name: "animated",
      type: "boolean" as const,
      group: "animation",
    },
    {
      name: "dottedBorder",
      type: "boolean" as const,
      group: "border",
    },
    {
      name: "dottedBorderSpacing",
      type: "number" as const,
      min: 0,
      max: 20,
      step: 1,
      group: "border",
    },
  ]

  const labelFields = [
    {
      name: "bgColor",
      type: "color" as const,
      group: "background",
      presetColors: [
        { label: "White", value: "#ffffff" },
        { label: "Gray", value: "#f3f4f6" },
        { label: "Primary", value: "#3b82f6" },
      ],
    },
    {
      name: "bgOpacity",
      type: "number" as const,
      min: 0,
      max: 1,
      step: 0.1,
      group: "background",
    },
    {
      name: "bgPadding",
      type: "number" as const,
      min: 0,
      max: 50,
      step: 1,
      group: "background",
    },
    {
      name: "borderColor",
      type: "color" as const,
      group: "border",
      presetColors: [
        { label: "Black", value: "#000000" },
        { label: "Gray", value: "#6b7280" },
        { label: "Primary", value: "#3b82f6" },
      ],
    },
    {
      name: "borderWidth",
      type: "number" as const,
      min: 0,
      max: 20,
      step: 1,
      group: "border",
    },
    {
      name: "borderRadius",
      type: "number" as const,
      min: 0,
      max: 50,
      step: 1,
      group: "border",
    },
    {
      name: "dottedBorder",
      type: "boolean" as const,
      group: "border",
    },
    {
      name: "dottedBorderSpacing",
      type: "number" as const,
      min: 0,
      max: 20,
      step: 1,
      group: "border",
    },
    {
      name: "textColor",
      type: "color" as const,
      group: "text",
      presetColors: [
        { label: "Black", value: "#000000" },
        { label: "Gray", value: "#6b7280" },
        { label: "Primary", value: "#3b82f6" },
      ],
    },
    {
      name: "textFontSize",
      type: "number" as const,
      min: 8,
      max: 72,
      step: 1,
      group: "text",
    },
    {
      name: "textFontWeight",
      type: "text" as const,
      group: "text",
    },
    {
      name: "textFontFamily",
      type: "text" as const,
      group: "text",
    },
    {
      name: "textOpacity",
      type: "number" as const,
      min: 0,
      max: 1,
      step: 0.1,
      group: "text",
    },
  ]

  const importantFields = [
    {
      name: "labelField",
      type: "select",
      options: propertyKeys.map(key => ({ label: key, value: key })),
      // group: "general",
      row: "basic",
    },
    {
      name: "imageField",
      type: "select",
      options: propertyKeys.map(key => ({ label: key, value: key })),
      // group: "general",
      row: "basic",
    }
  ]

  const importantFieldsRowConfig = [
    {
      id: "imp-fields-basic-1",
      fields: ["labelField", "imageField"],
    }

  ];

  const shapeRowConfig = [
    {
      id: "stroke-main-1",
      fields: ["strokeColor", "strokeWidth"],
    },
    {
      id: "stroke-main-2",
      fields: ["strokeOpacity"],
    },
  ]


  return (
    <div className={cn("container mx-auto p-4 w-[520px] h-full", className)}>
      {/* <div className="grid gap-4 lg:grid-cols-2"> */}
      <Card className=" overflow-auto">

        <CardContent className="p-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* <FormField
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
              /> */}
              <FormField.ObjectField
                control={form.control}
                name="fields"
                fields={importantFields}
                rowConfig={importantFieldsRowConfig}
                labelPosition={labelPosition}
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
                  // defaultExpanded={["stroke"]}

                  />
                </TabsContent>
                <TabsContent value="label" className="mt-2">
                  <FormField.ObjectField
                    control={form.control}
                    name="label"
                    fields={labelFields}
                    // rowConfig={labelRowConfig}
                    labelPosition={labelPosition}
                  />
                </TabsContent>
              </Tabs>

              <Button type="submit" className="">
                Submit
              </Button>
              {showReset && (
                <Button type="button" variant="outline" onClick={handleReset} className="ml-3">
                  Reset
                </Button>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
      {/* </div> */}
    </div>
  )
}

