import { CanvasGraph } from '@invana/canvas-graph';
import type { Meta, StoryObj } from '@storybook/react';
import { COVIDTimeSeriesGeoDataSet } from '@invana/example-datasets'
import { defaultContainerStyle, defaultOptions } from '../constants';
import { ANTV_DAGRE_LAYOUT, DENDROGRAM_LAYOUT, GRAPHIN_FORCE_LAYOUT, MINDMAP_LAYOUT } from '@invana/canvas-graph/defaults/layouts';


// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'Layouts/Time-Series-Geo',
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
      // layout: {
      // ...ANTV_DAGRE_LAYOUT,
      // radial: true,
      // direction: undefined,
      // }
    },
    initData: COVIDTimeSeriesGeoDataSet,
    containerStyle: defaultContainerStyle
  },
};


