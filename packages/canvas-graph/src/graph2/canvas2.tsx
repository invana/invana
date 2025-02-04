import React, { useState, useRef } from 'react';
import { Graphin } from '@antv/graphin';
import { Graph, GraphOptions } from '@antv/g6';
import { Button } from '@invana/ui';
import { CanvasGraphV2Props } from './types';
import { CanvasManager } from '../manager';
// import { flightData as data } from '@invana/example-datasets/datasets';
// import '@antv/graphin/dist/index.css';


export type GraphinLayout = {
  type: string;
  [key: string]: any;
};

export interface GraphinRef extends Graph {
  graph: Graph;
}

export const CanvasGraphV2: React.FC<CanvasGraphV2Props> = (props) => {
  // Sample graph data

  // Layout state
  const [layout, setLayout] = useState<GraphinLayout>({ type: 'circular' });

  // Ref for Graphin instance
  const graphinRef = useRef<GraphinRef>(null);

  // Update layout
  // For Graphin 3.x "force" is generally "grid", plus other options like "circular", "concentric", etc.
  const handleLayoutChange = (layoutType: 'circular' | 'grid') => {
    setLayout({ type: layoutType });
    if (graphinRef.current?.graph) {
      graphinRef.current.graph.setLayout({ type: layoutType });
      graphinRef.current.graph.layout();
    }
  };

  const options: GraphOptions = {
    // container: containerRef.current,
    // width: "100%",
    // height: "100%",
    // node: { style: { size: 20, labelText: (d) => d.id, } },
    // edge: { style: { stroke: '#666' } },

    // background: '#222222',
    // data: props.data,
    // autoResize: true,
    // autoFit: 'view', // 'view' | 'graph' | 'center'
    // animation: false,
    layout: layout,

    // autoFit: { type: 'view' }, // 'view' | 'graph' | 'center'
    behaviors: ['drag-element', 'drag-canvas', 'zoom-canvas', 'click-select'],
  }



  return (
    <div className='h-full w-full' style={props.containerStyle ?? {}}>
      <Graphin
        options={options}
        onReady={(graph) => {
          console.log("Graphin onReady", graph);
          const canvasManager: CanvasManager = new CanvasManager(graph, props.options ?? {});
          props.onReady(canvasManager);
          canvasManager?.store.addData(
            props.initData ?? { 'nodes': [], 'edges': [] },
            () => canvasManager?.render()
          );
        }}
        ref={graphinRef}
      />
      <div style={{ marginTop: '10px' }}>
        <Button className='mr-3' onClick={() => handleLayoutChange('circular')}>Circular Layout</Button>
        <Button onClick={() => handleLayoutChange('grid')}>Grid Layout</Button>
      </div>
    </div>
  );
};

