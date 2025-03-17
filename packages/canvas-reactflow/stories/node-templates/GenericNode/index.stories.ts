import { CanvasFlow } from '../../../src/app/app';
import type { Meta, StoryObj } from '@storybook/react';
import { data } from "./data";
import nodesData from '../../example-data/all-nodes.json';
import edgesData from '../../example-data/all-relationships.json';
import DagreLayoutEngine from '../../dagre-layout';
import { MarkerType } from "@xyflow/react";
import { stringToPastelColor } from '@invana/canvas-reactflow/lib/color_utils';




const nodes = nodesData.map((n) => {
  return {
    id: n['Entity_ID:ID'],
    type: 'GenericNode2',
    style: {
      background: stringToPastelColor(n[':Label'])
    },
    data: {
      type: n[':Label'],
      label: n['name']
    }
  }
})

const edges = edgesData.map((e) => {
  return {
    id: `${e[':START_ID']}-${e[':END_ID']}`,
    source: e[':START_ID'],
    target: e[':END_ID'],
    type: 'bezier',
    data: {
      type: e[':TYPE'],
      timestamp: e['timestamp']
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
  }
})

console.log("---------- nodes", nodes)

const layoutEngine = new DagreLayoutEngine()

const { layoutedNodes, layoutedEdges } = layoutEngine.getLayoutedElements(nodes, edges)

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'NodeTemplates/GenericNode',
  component: CanvasFlow,
  parameters: {
    layout: 'fullscreen',
  },
  // tags: ['autodocs'],
  // More on argTypes: https://storybook.js.org/docs/api/argtypes
  // argTypes: {
  //   backgroundColor: { control: 'color' },
  // },
} satisfies Meta<typeof CanvasFlow>;

export default meta;
type Story = StoryObj<typeof meta>;


export const GenericNode: Story = {
  args: {
    nodes: data.nodes,
    edges: data.edges,
    layoutDirection: "TB"
  },
};

export const GenericNode2: Story = {
  args: {
    nodes: layoutedNodes,
    edges: layoutedEdges,
  },
};