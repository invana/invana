import React, { useEffect, useRef } from 'react';
import { Graph } from '@antv/g6';
import useGraphStore from './store';




export const CanvasGraphV1 = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);

  const { nodes, edges, addNode, updateNode, removeNode, addEdge, updateEdge, removeEdge } = useGraphStore();

  useEffect(() => {
    if (!graphRef.current && containerRef.current) {
      graphRef.current = new Graph({
        container: containerRef.current,
        // width: "100%",
        // height: "100%",
        node: { style: { size: 30 } },
        edge: { style: { stroke: '#666' } },
        plugins: [
          'drag-node',
          'zoom-canvas',
          'drag-canvas'
        ],
        background: '#222222',
        data: {
          nodes: [{ id: 'node-1', style: { x: 100, y: 100 } }, { id: 'node-2', style: { x: 200, y: 200 } }],
          edges: [{ id: 'edge-1', source: 'node-1', target: 'node-2' }],
        },
        // autoFit: true,
        autoResize: true,
        autoFit: 'view', // 'view' | 'graph' | 'center'
        behaviors: ['drag-node', 'zoom-canvas', 'click-select'],
      });

      graphRef.current.fitView();
      // Initialize graph data
      // graphRef.current.setData({ nodes: Object.values(nodes), edges: Object.values(edges) });
      graphRef.current.render();
    }
  }, []);

  useEffect(() => {
    let nodeCount = 0;
    const interval = setInterval(() => {
      if (nodeCount >= 10) {
        clearInterval(interval);
        return;
      }

      const newNode = {
        id: `node-${Date.now()}`,
        style: { x: Math.random() * 800, y: Math.random() * 600 },
      };
      console.log('Adding node', newNode);
      graphRef.current?.addNodeData([newNode])
      graphRef.current?.render();
      graphRef.current?.fitView();
      // addNode(newNode);
      nodeCount++;
    }, 2000);

    return () => clearInterval(interval);
  }, [addNode]);

  // // Sync nodes
  // useEffect(() => {
  //   if (graphRef.current) {
  //     const graph = graphRef.current;

  //     const graphNodes = graph.getNodeData().map(node => node.id);
  //     const storeNodes = Object.keys(nodes);



  //     // Add new nodes
  //     storeNodes.forEach(id => {
  //       if (!graphNodes.includes(id)) {
  //         graph.addNodeData(nodes[id]);
  //       }
  //     });

  //     // Update existing nodes
  //     graph.getNodeData().forEach(node => {
  //       const id = node.id as string;
  //       if (nodes[id]) {
  //         // graph.updateNodeData([{id: node.id, nodes[id]}]);
  //         const { id: _, ...nodeData } = nodes[id];
  //         graph.updateNodeData([{ id: node.id, ...nodeData }]);

  //       }
  //     });

  //     // Remove deleted nodes
  //     graphNodes.forEach(id => {
  //       if (!storeNodes.includes(id)) {
  //         graph.removeItem(id);
  //       }
  //     });
  //   }
  // }, [nodes]);

  // // Sync edges
  // useEffect(() => {
  //   if (graphRef.current) {
  //     const graph = graphRef.current;
  //     const graphEdges = graph.getEdges().map(edge => edge.getModel().id);
  //     const storeEdges = Object.keys(edges);

  //     // Add new edges
  //     storeEdges.forEach(id => {
  //       if (!graphEdges.includes(id)) {
  //         graph.addItem('edge', edges[id]);
  //       }
  //     });

  //     // Update existing edges
  //     graph.getEdges().forEach(edge => {
  //       const id = edge.getModel().id as string;
  //       if (edges[id]) {
  //         graph.updateItem(edge, edges[id]);
  //       }
  //     });

  //     // Remove deleted edges
  //     graphEdges.forEach(id => {
  //       if (!storeEdges.includes(id)) {
  //         graph.removeItem(id);
  //       }
  //     });
  //   }
  // }, [edges]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

