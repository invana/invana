import { CanvasGraph } from '@invana/canvas-graph';
import type { Meta, StoryObj } from '@storybook/react';
import { modellingMethodsDataset } from '@invana/example-datasets'
import { defaultContainerStyle, defaultOptions } from '../constants';
import { MINDMAP_LAYOUT } from '@invana/canvas-graph/defaults/layouts';

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'Layouts/MindMap',
  component: CanvasGraph,
  parameters: {
    layout: 'fullscreen',
  },
  // tags: ['autodocs'],
} satisfies Meta<typeof CanvasGraph>;

export default meta;
type Story = StoryObj<typeof meta>;


export const LeftToRight: Story = {
  args: {
    options: {
      ...defaultOptions,
      styles: {
        defaultEdge: {
          shape: {
            type: 'cubic-horizontal',
            strokeOpacity: 0.8
          },
          label: {
            textColor: '#ffffff',
          }
        }
      },
      layout: {
        ...MINDMAP_LAYOUT,
        direction: 'LR'
      }
    },
    initData: modellingMethodsDataset,
    containerStyle: defaultContainerStyle
  },
};


