import { NodeDisplaySettings } from '@invana/ui';
import type { Meta, StoryObj } from '@storybook/react';


// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Graph Components/NodeDisplaySettings',
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

  },
};