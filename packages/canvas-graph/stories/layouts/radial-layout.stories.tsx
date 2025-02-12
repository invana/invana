import { CanvasGraph } from '@invana/canvas-graph';
import type { Meta, StoryObj } from '@storybook/react';
import { lesMiserablesData } from '@invana/example-datasets'
import { defaultContainerStyle, defaultOptions } from '../constants';
import { RADIAL_LAYOUT } from '@invana/canvas-graph/defaults/layouts';

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'Layouts/Radial',
  component: CanvasGraph,
  parameters: {
    layout: 'fullscreen',
  },
  // tags: ['autodocs'],
} satisfies Meta<typeof CanvasGraph>;

export default meta;
type Story = StoryObj<typeof meta>;



export const lesMiserables: Story = {
  args: {
    options: {
      ...defaultOptions,
      layout: {
        ...RADIAL_LAYOUT,
      }
    },
    initData: lesMiserablesData,
    containerStyle: defaultContainerStyle,
    onDestroy: () => { },
  },
};
