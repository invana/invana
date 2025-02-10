import { CanvasGraph } from '@invana/canvas-graph';
import type { Meta, StoryObj } from '@storybook/react';
import { usersDataSet } from '@invana/example-datasets'
import { defaultContainerStyle, defaultOptions } from '../constants';
import { D3_FORCE_LAYOUT } from '@invana/canvas-graph/defaults/layouts';

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'UseCases/SimpleData',
  component: CanvasGraph,
  parameters: {
    layout: 'fullscreen',
  },
  // tags: ['autodocs'],
} satisfies Meta<typeof CanvasGraph>;

export default meta;
type Story = StoryObj<typeof meta>;


export const SimpleExample: Story = {
  args: {
    options: {
      ...defaultOptions,
      styles: {
        defaultNode: {
          shape: {
            // size: 70,
            // type: 'rect',
          },
          fields: {
            labelField: 'name'
          }
        },
        nodes: {
          User: {
            fields: {
              labelField: 'name'
            }
          },
          Post: {
            fields: {
              labelField: 'title'
            }
          }
        },
        defaultEdge: {
          shape: {
            type: 'line',
            strokeOpacity: 0.8
          }
        }
      },
      layout: D3_FORCE_LAYOUT
    },
    initData: usersDataSet,
    containerStyle: defaultContainerStyle,
    onReady(canvasManager) {
      console.log("canvasManager", canvasManager);
      console.log("canvasManager.getGraphSchema()", JSON.stringify(canvasManager.getGraphSchema(), null, 2));
    },
  },
};

