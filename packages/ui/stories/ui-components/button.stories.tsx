import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { Button } from '@invana/ui';


// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'UI Components/Button',
  component: Button,
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/configure/story-layout
    layout: 'centered',
  },
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ['autodocs'],
  args: {
    variant: 'default', // Default prop values
    children: 'Click me',
    onClick: fn()
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Secondary: Story = {
  args: {
    // primary: true,
    variant: 'secondary',
  },
};

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Destructive: Story = {
  args: {
    // primary: true,
    variant: 'destructive',
  },
};
