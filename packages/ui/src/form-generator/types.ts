export type FieldType = "text" | "number" | "boolean" | "color" | "select" | "icon" | "object"

export interface BaseFieldConfig {
  name: string
  type: FieldType
  label?: string
  description?: string
  placeholder?: string
  group?: string
  row?: string
  validation?: {
    required?: boolean
    min?: number
    max?: number
    pattern?: string
    minLength?: number
    maxLength?: number
  }
}


// export interface IField {
//   name: string;
//   type: "number" | "boolean" | "select" | "time" | "image" | "text" | "color" | "icon" | "geo";
//   options?: { label: string; value: string; }[];
//   group?: string;
//   row?: string;
//   min?: number;
//   max?: number;
//   step?: number;
//   presetColors?: { label: string; value: string; }[];
//   defaultValue?: string;
// }


export interface TextFieldConfig extends BaseFieldConfig {
  type: "text"
}

export interface NumberFieldConfig extends BaseFieldConfig {
  type: "number"
  min?: number
  max?: number
  step?: number
}

export interface BooleanFieldConfig extends BaseFieldConfig {
  type: "boolean"
}

export interface ColorFieldConfig extends BaseFieldConfig {
  type: "color"
  presetColors?: Array<{ label: string; value: string; darkValue?: string }>
  defaultValue?: string
}

export interface SelectFieldConfig extends BaseFieldConfig {
  type: "select"
  options: Array<{ label: string; value: string }>
}

export interface IconFieldConfig extends BaseFieldConfig {
  type: "icon"
}

export interface ObjectFieldConfig extends BaseFieldConfig {
  type: "object"
  fields: FieldConfig[]
}

export type FieldConfig =
  | TextFieldConfig
  | NumberFieldConfig
  | BooleanFieldConfig
  | ColorFieldConfig
  | SelectFieldConfig
  | IconFieldConfig
  | ObjectFieldConfig

export interface FormBuilderConfig {
  title?: string
  description?: string
  fields: FieldConfig[]
  labelPosition?: "side" | "top"
  rowConfig?: Array<{
    id: string
    fields: string[]
  }>
}

