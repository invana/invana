import { CanvasGraph } from '@invana/canvas-graph';
import type { Meta, StoryObj } from '@storybook/react';
import { processMiningExample } from '@invana/example-datasets'
import { defaultContainerStyle, defaultOptions } from '../constants';
import { ANTV_DAGRE_LAYOUT } from '@invana/canvas-graph/defaults/layouts';

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'UseCases/ProcessMining',
  component: CanvasGraph,
  parameters: {
    layout: 'fullscreen',
  },
  // tags: ['autodocs'],
} satisfies Meta<typeof CanvasGraph>;

export default meta;
type Story = StoryObj<typeof meta>;


export const ProcessMining: Story = {
  args: {
    options: {
      ...defaultOptions,
      styles: {
        defaultNode: {
          shape: {
            size: 70,
            type: 'rect',
          },
        },
        defaultEdge: {
          shape: {
            type: 'polyline',
          }
        }
      },
      layout: ANTV_DAGRE_LAYOUT
    },
    initData: processMiningExample,
    containerStyle: defaultContainerStyle,
    onReady(canvasManager) {
      console.log("canvasManager", canvasManager)
      // setTimeout(() => {
      // canvasManager.styling.hideAllNodes();
      // }, 3000);
    },

  },
};
