import type { Meta, StoryObj } from '@storybook/react';
import { defaultContainerStyle, defaultOptions } from '../constants';
import '@invana/config-tailwind/index.css';
import { CanvasGraph } from '@invana/canvas-graph';
import { ICanvasData } from '@invana/data-store';
import { ANTV_DAGRE_LAYOUT } from '@invana/canvas-graph/defaults/layouts';
import { usersDataSet } from '@invana/example-datasets'

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'Styling/NodeTypes',
  component: CanvasGraph,
  parameters: {
    layout: 'fullscreen',
  },
  // tags: ['autodocs'],
} satisfies Meta<typeof CanvasGraph>;

export default meta;
type Story = StoryObj<typeof meta>;


const data: ICanvasData = {
  nodes: [
    {
      id: "a1",
      type: "User",
      properties: {
        name: "John Doe"  // This is the label of the node
      },
      display: {
        shape: {
          type: 'circle',
        },
        fields: {
          labelField: 'properties.name'
        }
      }
    },
    {
      id: "t1",
      type: "Tweet",
      properties: {
        text: "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book"  // This is the label of the node
      },
      display: {
        shape: {
          type: 'rect',
        },
        fields: {
          labelField: 'properties.text'
        }
      }
    },
    {
      id: "o1",
      properties: { title: "#myHashtag", likes: 100 },
      type: "HashTag",
      display: {
        shape: {
          type: 'rect',
        },
        fields: {
          labelField: 'properties.title'
        },
        label: {
          textPosition: 'center'
        }
      }
    },
  ],
  edges: [
    {
      id: "a1->t1",
      source: "a1",
      target: "t1",
      type: "Follows",
      properties: { since: 2022 },
    }
  ]
}

export const NodeTypes: Story = {
  args: {

    options: {
      ...defaultOptions,
      layout: ANTV_DAGRE_LAYOUT
    },
    onReady: (canvasManager) => {
      console.log("CanvasGraph.onReady canvasManager", canvasManager)

      // setTimeout(() => {
      //   const nodes = [
      //     { id: "newNode", type: "newType", properties: { name: "New Node" } },
      //     { id: "newNode-2", type: "newType", properties: { name: "New Node 2" } },
      //     { id: "newNode-3", type: "newType", properties: { name: "New Node 3" } },
      //   ];
      //   nodes.map(node => {
      //     canvasManager.store.addNode(node);
      //   })
      //   canvasManager.render().then(() => {
      //     console.log("CanvasGraph.rendered")
      //   })
      // }, 1000);
    },
    initData: data,
    containerStyle: defaultContainerStyle,
    // showHeader: true
  },
};

