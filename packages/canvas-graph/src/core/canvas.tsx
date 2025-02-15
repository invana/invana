import React, { useEffect, useRef } from 'react';
import { ICanvasEdge, ICanvasNode, mergeDeep } from '@invana/data-store';
import { Graphin } from '@antv/graphin';
import { Graph, type GraphData } from '@antv/g6';
// import useGraphStore from './store';
import { Button } from '@invana/ui';
import { CanvasGraphProps } from '../types';
import { convertToGraphinOptions } from './utils';
import { DEFAULT_CANVAS_GRAPH_OPTIONS } from '../styling/defaults';
import { CanvasManager } from '../canvas/manager';


export const CanvasGraph: React.FC<CanvasGraphProps> = (props) => {

  // const { nodes, edges, addData, addNode, addEdge } = useGraphStore();
  const canvasManagerRef = useRef<CanvasManager | null>(null);

  // useEffect(() => {
  //   // Simulate fetching or initializing graph data
  //   const initialNodes: ICanvasNode[] = [
  //     { id: '1', type: 'circle', label: 'Alice', x: 100, y: 150 },
  //     { id: '2', type: 'circle', label: 'Bob', x: 300, y: 150 },
  //   ];

  //   const initialEdges: ICanvasEdge[] = [
  //     { id: 'edge1', type: 'line', source: '1', target: '2' },
  //   ];

  //   addData(initialNodes, initialEdges);
  // }, [addData]);


  // const data = { nodes, edges } as GraphData;

  console.log("CanvasGraph -> props", props)
  console.log("CanvasGraph -> graph", canvasManagerRef.current)

  const handleAddData = () => {

    const nodesCount = canvasManagerRef.current?.store.data.nodes.length;
    const edgesCount = canvasManagerRef.current?.store.data.edges.length;

    canvasManagerRef.current?.store.addData(
      {
        nodes: [
          {
            id: ((nodesCount ?? 0) + 1).toString(),
            type: 'User',
            label: `David ${((nodesCount ?? 0) + 1).toString()}`,
            properties: {}
          },
        ],
        edges: [
          {
            id: `edge - ${((edgesCount ?? 0) + 1).toString()}`,
            type: 'link',
            source: '1',
            target: ((nodesCount ?? 0) + 1).toString(),
            properties: {}
          },
        ],
      },
      () => canvasManagerRef.current?.render()
    )
  }


  return (
    <div>
      {/* <Button
        className='mr-3'
        onClick={() => addNode({ id: (nodes.length + 1).toString(), type: 'circle', label: `Alice ${nodes.length}`, x: 100, y: 150 })}
      >Add Node</Button>
      <Button onClick={() => addEdge({ id: `edge${edges.length + 1}`, type: 'line', source: '1', target: '2' })}>Add Edge</Button> */}
      <Button
        onClick={() => handleAddData()}
      > Add Data</Button>
      {/* <p>Total nodes: {nodes.length}. Total Edges: {edges.length}</p> */}
      <Graphin
        onReady={(graph) => {
          const options = mergeDeep(DEFAULT_CANVAS_GRAPH_OPTIONS, props.options || {})
          const initData = props.initData ?? { 'nodes': [], 'edges': [] }
          console.log("Graphin onReady", props.graphName, graph, options);
          canvasManagerRef.current = new CanvasManager(graph, options);
          if (canvasManagerRef.current) {
            canvasManagerRef.current.store.addData(initData, () => canvasManagerRef.current?.render());
          }
          if (props.onReady) {
            props?.onReady?.(canvasManagerRef.current);
          }
        }}
        onDestroy={() => {
          console.log("Graphin onDestroy");
          // localRef.current?.destroy();
          canvasManagerRef.current?.destroy();
          props?.onDestroy?.();
        }}
        options={{}}
        style={props.containerStyle}
      // options={{ data: data, ...graphinProps.options, theme: 'dark' }}
      />
    </div>
  )
}

