import { MarkerType } from "@xyflow/react";


export const data = {
  nodes: [
    {
      id: '1',
      type: 'GenericNode',
      data: {
        label: 'Input Node',
      },
      position: { x: 250, y: 0 },
    },
    {
      id: '2',
      type: 'GenericNode',
      data: {
        label: 'Default Node',
      },
      position: { x: 100, y: 100 },
    },
    {
      id: '3',
      type: 'GenericNode',
      data: {
        label: 'Output Node',
      },
      position: { x: 400, y: 100 },
    },
    {
      id: '4',
      type: 'GenericNode',
      position: { x: 100, y: 200 },
      data: {
        label: 'Default Node 4',

      },
    },
    {
      id: '5',
      type: 'GenericNode',
      data: {
        label: 'custom style',
      },
      className: 'circle',
      style: {
        background: '#2B6CB0',
        color: 'white',
      },
      position: { x: 400, y: 200 },
      // sourcePosition: Position.Right,
      // targetPosition: Position.Left,
    }],
  edges: [
    { id: 'e1-2', source: '1', target: '2', label: 'this is an edge label' },
    { id: 'e1-3', source: '1', target: '3', animated: true },
    {
      id: 'e4-5',
      source: '4',
      target: '5',
      type: 'smoothstep',
      sourceHandle: 'handle-0',
      data: {
        selectIndex: 0,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
    }
  ]
}
