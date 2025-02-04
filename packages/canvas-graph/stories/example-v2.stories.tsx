import type { Meta, StoryObj } from '@storybook/react';
// import { flightData, lesMiserablesData } from '@invana/example-datasets'
import { CanvasGraphV2 } from '@invana/canvas-graph/graph2/canvas2';
import { flightData } from '@invana/example-datasets/datasets';
import { defaulNodeDisplaySettings, defaultCanvasDisplaySettings, defaultEdgeDisplaySettings } from '@invana/canvas-graph/graph2/defaults';

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'CanvasGraphV2',
  component: CanvasGraphV2,
  parameters: {
    layout: 'fullscreen',
  },
  // tags: ['autodocs'],
} satisfies Meta<typeof CanvasGraphV2>;

export default meta;
type Story = StoryObj<typeof meta>;


export const FlightData: Story = {
  args: {
    display: {
      defaultNode: defaulNodeDisplaySettings,
      defaultEdge: defaultEdgeDisplaySettings,
      canvas: defaultCanvasDisplaySettings
    },
    onReady: (graphManager) => {
      console.log("CanvasGraphV2.onReady graphManager", graphManager)
    },
    initData: flightData,
    style: { "width": "100%", "height": "calc(100vh - 46px)" }
  },
};

