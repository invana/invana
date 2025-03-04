import { CanvasGraph } from '@invana/canvas-graph';
import type { Meta, StoryObj } from '@storybook/react';
import { COVIDTimeSeriesGeoDataSet } from '@invana/example-datasets'
import { defaultContainerStyle, defaultOptions } from '../constants';
import { ANTV_DAGRE_LAYOUT, DENDROGRAM_LAYOUT, FORCE_LAYOUT, GRAPHIN_FORCE_LAYOUT, MINDMAP_LAYOUT } from '@invana/canvas-graph/defaults/layouts';
import { CanvasGraphPlugin } from '@invana/canvas-graph/types';



export const TIMEBAR_PLUGIN: CanvasGraphPlugin = {
  type: 'timebar',
  key: 'timebar',
  data: [
    {
      time: new Date('2020-01-22'),
      value: '22',
      label: '22',
    },
    {
      time: new Date('2020-01-24'),
      value: '24',
      label: '24',
    },
    {
      time: new Date('2020-01-26'),
      value: '26',
      label: '26',
    },
    {
      time: new Date('2020-01-28'),
      value: '28',
      label: '28',
    },
    {
      time: new Date('2020-01-30'),
      value: '30',
      label: '30',
    }
  ],
  width: 450,
  height: 100,
  loop: true,
  timebarType: 'chart',
}


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
      plugins: [
        ...(defaultOptions.plugins || []),
        TIMEBAR_PLUGIN
      ],
      styles: {
        defaultNode: {
          fields: {
            timestampField: 'properties.timestamp',
          }
        }
      },
      layout: FORCE_LAYOUT
      // layout: MINDMAP_LAYOUT
      // layout: {
      //   ...DENDROGRAM_LAYOUT,
      //   radial: true,
      //   direction: undefined,

      // }
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


