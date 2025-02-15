// CanvasGraph.tsx
import React, { useMemo } from "react";
import { useGraphStore } from "../store/data";
import { ICanvasEdge, ICanvasNode } from "@invana/data-store";


export const CanvasGraph = () => {
  // Subscribe to store actions and a derived state for re-rendering.
  const addNode = useGraphStore((state) => state.addNode);
  const addEdge = useGraphStore((state) => state.addEdge);
  const graph = useGraphStore((state) => state.graph);

  // Derive computed values to trigger re-renders when graph changes.
  // Here we use useMemo to compute nodes and edges arrays.
  const nodes = useMemo(() => graph.nodes(), [graph, graph.order]);
  const edges = useMemo(() => graph.edges(), [graph, graph.size]);

  const handleAddNode = () => {
    // Create a new node object.
    console.log("===CanvasGraph.handleAddNode")
    const newNode: ICanvasNode = {
      id: `node-${Date.now()}`,
      type: "Person",
      label: "New Node",
      properties: {},
    };
    addNode(newNode);
  };

  const handleAddEdge = () => {
    if (nodes.length < 2) return;
    // For example, add an edge between the first two nodes.
    const newEdge: ICanvasEdge = {
      id: `edge-${Date.now()}`,
      source: nodes[0],
      target: nodes[1],
      type: "connection",
      properties: {},
    };
    addEdge(newEdge);
  };

  console.log("===CanvasGraph.nodes", nodes, edges)
  return (
    <div>
      <h1>Graph Data</h1>
      <button onClick={handleAddNode}>Add Node</button>
      <button onClick={handleAddEdge}>Add Edge</button>

      <p>Total Nodes: {nodes.length}</p>
      <p>Total Edges: {edges.length}</p>

      <h2>Nodes</h2>
      <ul>
        {nodes.map((nodeId) => {
          const attributes = graph.getNodeAttributes(nodeId);
          return (
            <li key={nodeId}>
              <strong>{nodeId}</strong>: {JSON.stringify(attributes)}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

