"use client"
import React from "react"
import { Form } from "../../ui/form"
import { useForm } from "react-hook-form"
import { Card, CardContent, CardFooter, CardHeader } from "../../ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs"
import { ICanvasNodeDisplay } from "@invana/data-store"
import { cn } from "../../../lib/utils"
import { FormField } from "../../../form-generator/form-field"
import { Button } from "../../ui"


export interface NodeDisplaySettingsProps {
  onSubmit?: (data: ICanvasNodeDisplay) => void
  defaultValues: ICanvasNodeDisplay;
  propertyKeys: string[];
  labelPosition?: "side" | "top";
  className?: string;
  showReset?: boolean;
  header?: React.ReactNode

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

export const NodeDisplaySettings: React.FC<NodeDisplaySettingsProps> = ({ showReset = false,
  propertyKeys = [],
  defaultValues = {},
  labelPosition = "top",
  className = 'w-[420px]',
  ...props }) => {
  const form = useForm<ICanvasNodeDisplay>({
    defaultValues: defaultValues
  })

  // const [formData, setFormData] = useState<ICanvasNodeDisplay>()

  function onSubmit(data: ICanvasNodeDisplay) {
    // setFormData(data)
    props.onSubmit?.(data)
    console.log("Form submitted:", data)
  }

  function handleReset() {
    form.reset(defaultValues)
    // setFormData(undefined)
  }


  // labelField: string;
  // geoField: string;
  // imageField: string;
  // timestampField: string;
  const importantFields = [
    {
      name: "labelField",
      type: "select" as const,
      options: propertyKeys.map(key => ({ label: key, value: key })),
      // group: "general",
      row: "basic",
    },
    {
      name: "imageField",
      type: "select" as const,
      options: propertyKeys.map(key => ({ label: key, value: key })),
      // group: "general",
      row: "basic",
    },
    {
      name: "geoField",
      type: "select" as const,
      options: propertyKeys.map(key => ({ label: key, value: key })),
      // group: "general",
      row: "basic",
    },
    {
      name: "timestampField",
      type: "select" as const,
      options: propertyKeys.map(key => ({ label: key, value: key })),
      // group: "general",
      row: "basic",
    },
  ]
  const importantFieldsRowConfig = [
    {
      id: "imp-fields-basic-1",
      fields: ["labelField", "imageField"],
    },
    {
      id: "imp-fields-basic-2",
      fields: ["geoField", "timestampField"],
    }
  ];

  // const importantFieldsTab = (
  //   <FormField.ObjectField
  //     control={form.control}
  //     name="important"
  //     fields={importantFields}
  //     rowConfig={importantFieldsRowConfig}
  //     labelPosition={labelPosition}
  //   />
  // );


  const shapeFields = [
    {
      name: "type",
      type: "select" as const,
      options: shapeTypes,
      group: "general",
      row: "basic",
    },
    {
      name: "size",
      type: "number" as const,
      min: 0,
      max: 500,
      step: 1,
      group: "general",
      row: "basic",
    },
    {
      name: "animated",
      type: "boolean" as const,
      group: "general",
      row: "basic",
    },
    {
      name: "bgColor",
      type: "color" as const,
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
      type: "number" as const,
      min: 0,
      max: 1,
      step: 0.1,
      group: "background",
      row: "bg-main",
    },
    {
      name: "bgPadding",
      type: "number" as const,
      min: 0,
      max: 50,
      step: 1,
      group: "background",
      row: "bg-main",
    },
    {
      name: "borderColor",
      type: "color" as const,
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
      name: "borderWidth",
      type: "number" as const,
      min: 0,
      max: 20,
      step: 1,
      group: "border",
      row: "border-main",
    },
    {
      name: "borderRadius",
      type: "number" as const,
      min: 0,
      max: 50,
      step: 1,
      group: "border",
      row: "border-main",
    },
    {
      name: "dottedBorder",
      type: "boolean" as const,
      group: "border",
      row: "border-main",
    },
    {
      name: "dottedBorderSpacing",
      type: "number" as const,
      min: 0,
      max: 20,
      step: 1,
      group: "border",
      row: "border-main",
    },
    {
      name: "iconFontFamily",
      type: "text" as const,
      group: "icon",
      row: "icon-main",
    },
    {
      name: "iconCode",
      type: "icon" as const,
      group: "icon",
      row: "icon-main",
    },
    {
      name: "iconColor",
      type: "color" as const,
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
      type: "number" as const,
      min: 0,
      max: 100,
      step: 1,
      group: "icon",
      row: "icon-main",
    },
    {
      name: "iconOpacity",
      type: "number" as const,
      min: 0,
      max: 1,
      step: 0.1,
      group: "icon",
      row: "icon-main",
    },
    {
      name: "iconRotate",
      type: "number" as const,
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
      type: "color" as const,
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
      type: "number" as const,
      min: 0,
      max: 1,
      step: 0.1,
      group: "background",
      row: "bg-main",
    },
    {
      name: "bgPadding",
      type: "number" as const,
      min: 0,
      max: 50,
      step: 1,
      group: "background",
      row: "bg-main",
    },
    {
      name: "borderColor",
      type: "color" as const,
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
      name: "borderWidth",
      type: "number" as const,
      min: 0,
      max: 20,
      step: 1,
      group: "border",
      row: "border-main",
    },
    {
      name: "borderRadius",
      type: "number" as const,
      min: 0,
      max: 50,
      step: 1,
      group: "border",
      row: "border-main",
    },
    {
      name: "dottedBorder",
      type: "boolean" as const,
      group: "border",
      row: "border-main",
    },
    {
      name: "dottedBorderSpacing",
      type: "number" as const,
      min: 0,
      max: 20,
      step: 1,
      group: "border",
      row: "border-main",
    },
    {
      name: "textColor",
      type: "color" as const,
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
      type: "number" as const,
      min: 8,
      max: 72,
      step: 1,
      group: "text",
      row: "text-main",
    },
    {
      name: "textFontWeight",
      type: "text" as const,
      group: "text",
      row: "text-main",
    },
    {
      name: "textFontFamily",
      type: "text" as const,
      group: "text",
      row: "text-main",
    },
    {
      name: "textOpacity",
      type: "number" as const,
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
      fields: ["bgPadding", "bgOpacity"],
    },
    {
      id: "background-main-2",
      fields: ["bgColor"],
    },
    {
      id: "border-main-1",
      fields: ["borderColor", "borderWidth"],
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
      fields: ["borderColor", "borderWidth"],
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
    <div className={cn("min-h-screen ", className)}>
      <form onSubmit={form.handleSubmit(onSubmit)} >

        <Card className=" mx-auto w-full max-w-lg h-[calc(100vh-2rem)] flex flex-col w-[520px]  ">

          {props.header && <CardHeader>{props.header}</CardHeader>}

          <Form {...form}>
            <CardContent className=" space-y-4 flex-1 overflow-y-auto ">

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
              {/* <div className="  h-[100% - 90px]"> */}
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
                    rowConfig={labelRowConfig}
                    labelPosition={labelPosition}
                  />
                </TabsContent>
              </Tabs>
              {/* </div> */}
            </CardContent>

            {/* Fixed footer with submit button */}
            <CardFooter className="pt-2 !pb-2 mt-2 ">
              <div className="flex justify-between w-full">
                <Button type="submit" className=" ">
                  Update Settings
                </Button>
                {showReset && (
                  <Button type="button" variant="outline" onClick={handleReset}>
                    Reset
                  </Button>
                )}
              </div>
            </CardFooter>
          </Form>
        </Card>
      </form>

    </div>
  )
}

