import type { Meta, StoryObj } from '@storybook/react';
import { data } from "./simple-data";
import { data as groupdData } from "./grouped-data";
import { CanvasFlow } from '../../../src/app/app';
import { Edge, Node } from '@xyflow/react';


// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'Use Cases/ER Driagram',
  component: CanvasFlow,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof CanvasFlow>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Basic: Story = {
  args: {
    nodes: data.nodes,
    edges: data.edges
  },
};


export const ERDriagramGrouped: Story = {
  name: "Grouped ER",
  args: {
    nodes: groupdData.nodes as Node[],
    edges: groupdData.edges as Edge[]
  },
};