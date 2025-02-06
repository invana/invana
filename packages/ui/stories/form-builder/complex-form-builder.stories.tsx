import { NodeDisplaySettings } from '@/index';
import { CanvasNodeStyle } from '@invana/data-store';
import type { Meta, StoryObj } from '@storybook/react';


// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Form Builder/Complex Form',
  component: NodeDisplaySettings,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {

  },
} satisfies Meta<typeof NodeDisplaySettings>;

export default meta;
type Story = StoryObj<typeof meta>;


// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Default: Story = {
  args: {
    // className: 'w-[300px]',
    onSubmit: (data: CanvasNodeStyle) => {
      console.log("onSubmit", data)
    },
    defaultValues: {},
    propertyKeys: []
  },
};