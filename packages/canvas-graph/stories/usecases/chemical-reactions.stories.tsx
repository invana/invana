import { CanvasGraph } from '@invana/canvas-graph';
import type { Meta, StoryObj } from '@storybook/react';

import { defaultContainerStyle, defaultOptions } from '../constants';
import { ANTV_DAGRE_LAYOUT, } from '@invana/canvas-graph/defaults/layouts';
import { krebsCycleDataSet } from '@invana/example-datasets/datasets';

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'UseCases/ChemicalReactions',
  component: CanvasGraph,
  parameters: {
    layout: 'fullscreen',
  },
  // tags: ['autodocs'],
} satisfies Meta<typeof CanvasGraph>;

export default meta;
type Story = StoryObj<typeof meta>;


export const krebsCycle: Story = {
  args: {
    options: {
      ...defaultOptions,
      layout: ANTV_DAGRE_LAYOUT
    },
    initData: krebsCycleDataSet,
    containerStyle: defaultContainerStyle,
  },
};

