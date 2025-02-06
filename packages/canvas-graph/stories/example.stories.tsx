import type { Meta, StoryObj } from '@storybook/react';
// import { flightData, lesMiserablesData } from '@invana/example-datasets'
// import { flightData as data } from '@invana/example-datasets/datasets';
import { lesMiserablesData as data } from "@invana/example-datasets";
import { CanvasGraph } from '@invana/canvas-graph/canvas';
import { defaultOptions } from './constants';

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'Example',
  component: CanvasGraph,
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
    //   styles: {
    //     defaultNode: {
    //       shape: {
    //         bgColor: "green",
    //       }
    //     },
    //     defaultEdge: {
    //       shape: {
    //         strokeColor: "red",
    //       }
    //     },
    //     canvas: {

    //     }
    //   }
    // },
    options: defaultOptions,
    onReady: (canvasManager) => {
      console.log("CanvasGraph.onReady canvasManager", canvasManager)

      // setTimeout(() => {
      //   const nodes = [
      //     { id: "newNode", type: "newType", properties: { name: "New Node" } },
      //     { id: "newNode-2", type: "newType", properties: { name: "New Node 2" } },
      //     { id: "newNode-3", type: "newType", properties: { name: "New Node 3" } },
      //   ];

      //   nodes.map(node => {
      //     canvasManager.store.addNode(node);
      //   })
      //   canvasManager.render();
      // }, 3000);
    },
    initData: data,
    containerStyle: { "width": "100%", "height": "calc(100vh - 46px)" }
  },
};

