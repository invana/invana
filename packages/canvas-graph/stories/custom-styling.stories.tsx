import type { Meta, StoryObj } from '@storybook/react';
import { flightData } from '@invana/example-datasets'
import { CanvasGraph } from '@invana/canvas-graph/canvas';
import { defaultContainerStyle, defaultOptions } from './constants';
import '@invana/config-tailwind/index.css';

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'Custome Styling',
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

    options: {
      ...defaultOptions,
      styles: {
        nodes: {
          'Customer Country': {
            shape: {
              size: 40,
              type: 'rect',
              iconSrc: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQnKLdsc-TdAF7KaMurqTv97pngOg3NzFnHGg&s'
            },
            label: {
              textColor: 'red'
            }
          },
          'Vehicle Type': {
            shape: {
              iconText: '🚀',
            }
          },
          'Launch Site': {
            shape: {
              size: 70,
              type: 'hexagon',
              iconText: '🏞'
            }
          }
        },
        edges: {
          'launched_from': {
            shape: {
              strokeColor: "#cccccc",
              // type: 'line'
            },
          }
        }
      }
    },
    onReady: (canvasManager) => {
      console.log("CanvasGraph.onReady canvasManager", canvasManager)

      setTimeout(() => {
        // const nodes = [
        //   { id: "newNode", type: "newType", properties: { name: "New Node" } },
        //   { id: "newNode-2", type: "newType", properties: { name: "New Node 2" } },
        //   { id: "newNode-3", type: "newType", properties: { name: "New Node 3" } },
        // ];

        // nodes.map(node => {
        //   canvasManager.store.addNode(node);
        // })


        // canvasManager.render().then(() => {
        canvasManager.styling.hideAllNodeLabels();
        // })


      }, 1000);
    },
    initData: flightData,
    containerStyle: defaultContainerStyle,
    showHeader: true
  },
};

