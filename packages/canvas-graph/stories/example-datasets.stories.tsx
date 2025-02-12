import { CanvasGraph } from '@invana/canvas-graph';
import type { Meta, StoryObj } from '@storybook/react';
import { flightData, lesMiserablesData } from '@invana/example-datasets'
import { defaultContainerStyle, defaultOptions } from './constants';

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'Example Datasets',
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
    options: defaultOptions,
    initData: {
      nodes: flightData.nodes,
      edges: flightData.edges,
    },
    containerStyle: defaultContainerStyle,
    onReady(canvasManager) {
      console.log("canvasManager", canvasManager)
      // setTimeout(() => {
      // canvasManager.styling.hideAllNodes();
      // }, 3000);
    },

  },
};

export const LesMiserables: Story = {
  args: {
    options: defaultOptions,
    initData: {
      nodes: lesMiserablesData.nodes,
      edges: lesMiserablesData.edges,
    },
    containerStyle: defaultContainerStyle,
    onReady(canvasManager) {
      console.log("onReady", canvasManager)
      // setTimeout(() => {
      // canvasManager.styling.hideAllNodes();
      // }, 3000);
    },
  },
};