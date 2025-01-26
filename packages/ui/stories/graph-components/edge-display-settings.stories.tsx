import { EdgeDisplaySettings, EdgeDisplaySettingsProps } from '@invana/ui';
import type { Meta, StoryObj } from '@storybook/react';


// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta: Meta<EdgeDisplaySettingsProps> = {
  title: 'Graph UI Components/EdgeDisplaySettings',
  component: EdgeDisplaySettings,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {

  },
} satisfies Meta<typeof EdgeDisplaySettings>;

export default meta;
type Story = StoryObj<typeof meta>;


// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Default: Story = {
  args: {
    onSubmit: (data) => {
      console.log("onSubmit", data);
    },
    className: "min-w-[480px] h-full",
    // showProperties: true,
  },
};