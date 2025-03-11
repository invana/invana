import { CanvasFlow } from '../../../src/app/app';
import type { Meta, StoryObj } from '@storybook/react';
import { data } from "./data";


// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'NodeTemplates/CardNode',
  component: CanvasFlow,
  parameters: {
    layout: 'fullscreen',
  },
  // tags: ['autodocs'],
  // More on argTypes: https://storybook.js.org/docs/api/argtypes
  // argTypes: {
  //   backgroundColor: { control: 'color' },
  // },
} satisfies Meta<typeof CanvasFlow>;

export default meta;
type Story = StoryObj<typeof meta>;


export const CardNode: Story = {
  args: {
    nodes: data.nodes,
    edges: data?.edges,
  },
};