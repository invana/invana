import type { Meta, StoryObj } from '@storybook/react';
import { CanvasFlow } from '../../../src/app/app';
import DagreLayoutEngine from '../../dagre-layout';
import { getData } from './data';


// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'Use Cases',
  component: CanvasFlow,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof CanvasFlow>;

export default meta;
type Story = StoryObj<typeof meta>;


const layoutEngine = new DagreLayoutEngine({
  nodeWidth: 500,
  padding: 100
})
const data = getData()
const { layoutedNodes, layoutedEdges } = layoutEngine.getLayoutedElements(data.nodes, data.edges)

export const InsuranceAnalytics: Story = {
  args: {
    nodes: layoutedNodes,
    edges: layoutedEdges,
    canvas: {
      colorMode: 'light'
    },
    display: {
      plugins: {
        devTools: false,
        miniMap: true,
        controls: false,
        background: true,
        theme: true
      }
    }
  },
};
