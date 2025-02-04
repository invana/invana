import { CanvasGraph } from '@invana/canvas-graph';
import type { Meta, StoryObj } from '@storybook/react';
// import { flightData, lesMiserablesData } from '@invana/example-datasets'
import { CanvasGraphV2 } from '@invana/canvas-graph/graph2/canvas2';


// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'CanvasGraphV2',
  component: CanvasGraphV2,
  parameters: {
    layout: 'fullscreen',
  },
  // tags: ['autodocs'],
} satisfies Meta<typeof CanvasGraph>;

export default meta;
type Story = StoryObj<typeof meta>;


export const FlightData: Story = {
  args: {
    // options: {
    // },
    // initialData: {
    //   nodes: flightData.nodes,
    //   edges: flightData.edges,
    // },
    // header: true,
    // style: { "width": "100%", "height": "calc(100vh - 40px)" }
  },
};

export const LesMiserables: Story = {
  args: {
    // options: {
    // },
    // initialData: {
    //   nodes: lesMiserablesData.nodes,
    //   edges: lesMiserablesData.edges,
    // },
    // header: true,
    // style: { "width": "100%", "height": "calc(100vh - 40px)" }
  },
};