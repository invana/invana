import type { Meta, StoryObj } from '@storybook/react';
// import { flightData, lesMiserablesData } from '@invana/example-datasets'
import { CanvasGraphV2 } from '@invana/canvas-graph/graph2/canvas2';
import { flightData } from '@invana/example-datasets/datasets';
import { defaultNodeDisplaySettings, defaultCanvasDisplaySettings, defaultEdgeDisplaySettings } from '@invana/canvas-graph/manager/defaults';

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
    styles: {
      defaultNode: defaultNodeDisplaySettings,
      defaultEdge: defaultEdgeDisplaySettings,
      canvas: defaultCanvasDisplaySettings
    },
    onReady: (canvasManager) => {
      console.log("CanvasGraphV2.onReady canvasManager", canvasManager)

      setTimeout(() => {
        const nodes = [
          { id: "newNode", type: "newType", properties: { name: "New Node" } },
          { id: "newNode-2", type: "newType", properties: { name: "New Node 2" } },
          { id: "newNode-3", type: "newType", properties: { name: "New Node 3" } },
        ];

        nodes.map(node => {
          canvasManager.store.addNode(node);
        })
        canvasManager.render();
      }, 3000);
    },
    initData: flightData,
    containerStyle: { "width": "100%", "height": "calc(100vh - 46px)" }
  },
};

