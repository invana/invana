import type { Meta, StoryObj } from '@storybook/react';
import { data } from "./data";
import { CanvasFlow } from '../../../src/app/app';


// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'NodeTemplates/AnnotationNode',
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


export const AnnotationNode: Story = {
  args: {
    nodes: data.nodes,
    edges: data.edges,
    layoutDirection: "TB"
  },
};