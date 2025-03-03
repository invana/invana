import type { Meta, StoryObj } from '@storybook/react';
import { flightData } from '@invana/example-datasets'
import { defaultContainerStyle, defaultOptions } from '../constants';
import '@invana/config-tailwind/index.css';
import { CanvasGraph } from '@invana/canvas-graph';
import { ICanvasNode } from '@invana/data-store';

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'Styling/NodeTypes',
  component: CanvasGraph,
  parameters: {
    layout: 'fullscreen',
  },
  // tags: ['autodocs'],
} satisfies Meta<typeof CanvasGraph>;

export default meta;
type Story = StoryObj<typeof meta>;


const nodes: ICanvasNode[] = [
  {
    id: "1",
    type: "Customer Country",
    properties: {
      name: "Customer Country"  // This is the label of the node
    },
    display: {
      shape: {
        type: 'circle',
      }
    }
  }
]

export const NodeTypes: Story = {
  args: {

    options: {
      ...defaultOptions
    },
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
      //   canvasManager.render().then(() => {
      //     console.log("CanvasGraph.rendered")
      //   })
      // }, 1000);
    },
    initData: { nodes, edges: [] },
    containerStyle: defaultContainerStyle,
    // showHeader: true
  },
};

