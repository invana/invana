import { ICanvasData, ICanvasEdge, ICanvasNode } from "@invana/data-store";


export const processMiningSimpleDataset: ICanvasData = {
  nodes: [
    { id: '0', label: 'Start', type: 'start', },
    { id: '1', label: 'Task A', type: 'task', },
    { id: '2', label: 'Task B', type: 'task', },
    { id: '3', label: 'Task C', type: 'task', },
    { id: '4', label: 'Task D', type: 'task', },
    { id: '5', label: 'Task E', type: 'task', },
    { id: '6', label: 'Task F', type: 'task', },
    { id: '7', label: 'Task G', type: 'task', },
    { id: '8', label: 'Task H', type: 'task', },
    { id: '9', label: 'End', type: 'end', },
  ] as ICanvasNode[],
  edges: [
    { id: 'e0-1', source: '0', target: '1', label: 'Edge 0-1', },
    { id: 'e0-2', source: '0', target: '2', label: 'Edge 0-2', },
    { id: 'e1-4', source: '1', target: '4', label: 'Edge 1-4', },
    { id: 'e0-3', source: '0', target: '3', label: 'Edge 0-3', },
    { id: 'e3-4', source: '3', target: '4', label: 'Edge 3-4', },
    { id: 'e4-5', source: '4', target: '5', label: 'Edge 4-5', },
    { id: 'e4-6', source: '4', target: '6', label: 'Edge 4-6', },
    { id: 'e5-7', source: '5', target: '7', label: 'Edge 5-7', },
    { id: 'e5-8', source: '5', target: '8', label: 'Edge 5-8', },
    { id: 'e8-9', source: '8', target: '9', label: 'Edge 8-9', },
    { id: 'e2-9', source: '2', target: '9', label: 'Edge 2-9', },
    { id: 'e3-9', source: '3', target: '9', label: 'Edge 3-9', },
  ] as ICanvasEdge[],
};
