import React, { useEffect } from 'react';
import { ICanvasEdge, ICanvasNode } from '@invana/data-store';
import { Graphin } from '@antv/graphin';
import type { GraphData } from '@antv/g6';
import useGraphStore from './store';
import { Button } from '@invana/ui';
import { CanvasGraphProps } from '../types';
import { convertToGraphinOptions } from './utils';


export const CanvasGraph: React.FC<CanvasGraphProps> = (props) => {

  const { nodes, edges, addData, addNode, addEdge } = useGraphStore();

  useEffect(() => {
    // Simulate fetching or initializing graph data
    const initialNodes: ICanvasNode[] = [
      { id: '1', type: 'circle', label: 'Alice', x: 100, y: 150 },
      { id: '2', type: 'circle', label: 'Bob', x: 300, y: 150 },
    ];

    const initialEdges: ICanvasEdge[] = [
      { id: 'edge1', type: 'line', source: '1', target: '2' },
    ];

    addData(initialNodes, initialEdges);
  }, [addData]);


  const data = { nodes, edges } as GraphData;

  const graphinProps = convertToGraphinOptions(props);

  console.log('data', data, graphinProps.options?.layout);
  return (
    <div>
      <Button
        className='mr-3'
        onClick={() => addNode({ id: (nodes.length + 1).toString(), type: 'circle', label: `Alice ${nodes.length}`, x: 100, y: 150 })}
      >Add Node</Button>
      <Button onClick={() => addEdge({ id: `edge${edges.length + 1}`, type: 'line', source: '1', target: '2' })}>Add Edge</Button>
      <Button
        onClick={() => addData(
          [
            { id: (nodes.length + 1).toString(), type: 'circle', label: `David ${(nodes.length + 1).toString()}`, x: 700, y: 150 },
          ],
          [
            { id: `edge - ${(edges.length + 1).toString()}`, type: 'line', source: '1', target: (nodes.length + 1).toString(), },
          ]
        )}
      > Add Data</Button>



      <p>Total nodes: {nodes.length}. Total Edges: {edges.length}</p>
      <Graphin options={{ data: data, ...graphinProps.options }} />
    </div>
  )
}

