import { SimpleFormGenerator } from '@/components/graph-components/simple-form';
import { FormBuilderConfig } from '@/form-generator/types';
import { Button } from '@/index';
import type { Meta, StoryObj } from '@storybook/react';


// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Form Builder/SimpleFormGenerator',
  component: SimpleFormGenerator,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {

  },
} satisfies Meta<typeof SimpleFormGenerator>;

export default meta;
type Story = StoryObj<typeof meta>;


const config: FormBuilderConfig = {
  title: "User Profile",
  description: "Fill in your details to create a new account",
  labelPosition: "top",
  fields: [
    {
      type: "text",
      name: "name",
      label: "Name",
      description: "Your full name",
      validation: {
        required: true,
        minLength: 2,
      },
    },
    {
      type: "number",
      name: "age",
      label: "Age",
      min: 0,
      max: 150,
      validation: {
        required: true,
      },
    },
    {
      type: "boolean",
      name: "subscribe",
      label: "Subscribe to newsletter",
      description: "Receive updates about our products and announcements",
    },
    {
      type: "color",
      name: "favoriteColor",
      label: "Favorite Color",
      presetColors: [
        { label: "Red", value: "#ef4444" },
        { label: "Blue", value: "#3b82f6" },
        { label: "Green", value: "#22c55e" },
      ],
    },
    {
      type: "select",
      name: "country",
      label: "Country",
      description: "Select your country",
      options: [
        { label: "United States", value: "us" },
        { label: "United Kingdom", value: "uk" },
        { label: "Canada", value: "ca" },
      ],
    },
    {
      type: "icon",
      name: "icon",
      label: "Select Icon",
    },
  ],
  rowConfig: [
    {
      id: "personal",
      fields: ["name", "age"],
    },
    {
      id: "preferences",
      fields: ["favoriteColor", "icon"],
    },
  ]
}

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Default: Story = {
  args: {
    // className: 'w-[360px]',
    config,
    defaultValues: {
      "name": "change me",
      "age": 97,
      "favoriteColor": "#22c55e"
    },
    onSubmit: (data) => {
      console.log("Form submitted", data)
    },
  },
};