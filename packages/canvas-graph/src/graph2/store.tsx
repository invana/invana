import { create } from 'zustand';
import { ICanvasNode, ICanvasEdge, ICanvasEdgeStyle, CanvasNodeStyle } from '@invana/data-store';

interface CanvasSettings {
  width: number;
  height: number;
  backgroundColor?: string;
  renderer: 'canvas' | 'svg' | 'webgl';
}

interface GraphSettings {
  canvas: CanvasSettings;
}

interface GraphState {
  nodes: Record<string, ICanvasNode>;
  edges: Record<string, ICanvasEdge>;
  settings: GraphSettings;
  setSettings: (settings: Partial<GraphSettings>) => void;
  addNode: (node: ICanvasNode) => void;
  updateNode: (id: string, updates: Partial<ICanvasNode>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: ICanvasEdge) => void;
  updateEdge: (id: string, updates: Partial<ICanvasEdge>) => void;
  removeEdge: (id: string) => void;
}

const useGraphStore = create<GraphState>((set) => ({
  nodes: {},
  edges: {},
  settings: {
    canvas: { width: 800, height: 600, backgroundColor: '#fff', renderer: 'canvas' },
  },

  setSettings: (settings) =>
    set((state) => ({
      settings: { ...state.settings, ...settings },
    })),

  addNode: (node) =>
    set((state) => ({
      nodes: { ...state.nodes, [node.id]: node },
    })),

  updateNode: (id, updates) =>
    set((state) => ({
      nodes: { ...state.nodes, [id]: { ...state.nodes[id], ...updates } },
    })),

  removeNode: (id) =>
    set((state) => {
      const nodes = { ...state.nodes };
      delete nodes[id];
      const edges = Object.fromEntries(
        Object.entries(state.edges).filter(([_, edge]) => edge.source !== id && edge.target !== id)
      );
      return { nodes, edges };
    }),

  addEdge: (edge) =>
    set((state) => ({
      edges: { ...state.edges, [edge.id]: edge },
    })),

  updateEdge: (id, updates) =>
    set((state) => ({
      edges: { ...state.edges, [id]: { ...state.edges[id], ...updates } },
    })),

  removeEdge: (id) =>
    set((state) => {
      const edges = { ...state.edges };
      delete edges[id];
      return { edges };
    }),
}));

export default useGraphStore;
