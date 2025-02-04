import React, { useState, useRef } from 'react';
import { Graphin } from '@antv/graphin';
import { GraphData } from '@antv/g6';
import { Graph } from '@antv/g6';
import { Button } from '@invana/ui';
// import { flightData as data } from '@invana/example-datasets/datasets';
// import '@antv/graphin/dist/index.css';


export type GraphinLayout = {
  type: string;
  [key: string]: any;
};

export interface GraphinRef extends Graph {
  graph: Graph;
}

export const CanvasGraphV2: React.FC = () => {
  // Sample graph data
  const data: GraphData = {
    nodes: [
      { id: 'node-1', label: 'Node 1' },
      { id: 'node-2', label: 'Node 2' },
      { id: 'node-3', label: 'Node 3' },
      { id: 'node-4', label: 'Node 4' },
      { id: 'node-5', label: 'Node 5' },
    ],
    edges: [
      { source: 'node-1', target: 'node-2' },
      { source: 'node-2', target: 'node-3' },
      { source: 'node-3', target: 'node-4' },
      { source: 'node-4', target: 'node-5' },
      { source: 'node-5', target: 'node-1' },
    ],
  };

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

  const options = {
    // container: containerRef.current,
    // width: "100%",
    // height: "100%",
    node: { style: { size: 20, labelText: (d) => d.id, } },
    edge: { style: { stroke: '#666' } },

    background: '#222222',
    data: data,
    autoResize: true,
    layout: layout,
    // autoFit: { type: 'view' }, // 'view' | 'graph' | 'center'
    behaviors: ['drag-element', 'zoom-canvas', 'click-select'],
  }

  return (
    <div>
      <Graphin options={options} ref={graphinRef} />
      <div style={{ marginTop: '10px' }}>
        <Button className='mr-3' onClick={() => handleLayoutChange('circular')}>Circular Layout</Button>
        <Button onClick={() => handleLayoutChange('grid')}>Grid Layout</Button>
      </div>
    </div>
  );
};

