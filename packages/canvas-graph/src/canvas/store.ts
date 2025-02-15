import { CanvasEdgeStyle, CanvasNodeStyle, ICanvasEdge, ICanvasNode, ICanvasStyle } from "@invana/data-store";
import { create } from "zustand"
import { persist } from "zustand/middleware";


export interface CanvasGraphDataState {

  nodes: ICanvasNode[];
  edges: ICanvasEdge[];

  addNodes: (nodes: ICanvasNode[]) => void;
  addEdges: (edges: ICanvasEdge[]) => void;

  removeNodesByIds: (nodeIds: string[]) => void;
  removeEdgesByIds: (edgeIds: string[]) => void;

  updateNode: (nodeId: string, node: Omit<ICanvasNode, 'id'>) => ICanvasNode | null;
  updateEdge: (edgeId: string, edge: Omit<ICanvasEdge, 'id'>) => ICanvasEdge | null;

  clearNodes: () => void;
  clearEdges: () => void;

  clearAll: () => void;

}


export interface CanvasGraphStyleState {

  // default styling
  defaultNode: CanvasNodeStyle;
  defaultEdge: CanvasEdgeStyle;

  // styling of canvas
  canvas: ICanvasStyle;

  // styling by types 
  nodes: { [key: string]: CanvasNodeStyle };
  edges: { [key: string]: CanvasEdgeStyle };

  setDefaultNodeStyle: (nodeStyle: CanvasNodeStyle) => void;
  setDefaultEdgeStyle: (edgeStyle: CanvasEdgeStyle) => void;

  setNodeStyle: (nodeType: string, style: CanvasNodeStyle) => void;
  setEdgeStyle: (edgeType: string, style: CanvasEdgeStyle) => void;

  setCanvasStyle: (style: ICanvasStyle) => void;

  clearAll: () => void;

}


export const userCanvasGraphDataStore = create(
  persist<CanvasGraphDataState>(
    (set) => ({

      nodes: [],
      edges: [],

      addNodes: (nodes: ICanvasNode[]) => set((state) => ({ nodes: [...state.nodes, ...nodes] })),
      addEdges: (edges: ICanvasEdge[]) => set((state) => ({ edges: [...state.edges, ...edges] })),

      removeNodesByIds: (nodeIds: string[]) => set((state) => ({ nodes: state.nodes.filter(node => !nodeIds.includes(node.id)) })),
      removeEdgesByIds: (edgeIds: string[]) => set((state) => ({ edges: state.edges.filter(edge => !edgeIds.includes(edge.id)) })),

      updateNode: (nodeId: string, node: Omit<ICanvasNode, 'id'>): ICanvasNode | null => {
        let updatedNode: ICanvasNode | null = null;
        set((state) => {
          const nodes = state.nodes.map((n) => {
            if (n.id === nodeId) {
              updatedNode = { ...n, ...node };
              return updatedNode;
            }
            return n;
          });
          return { nodes };
        });
        return updatedNode || null;
      },

      updateEdge: (edgeId: string, edge: Omit<ICanvasEdge, 'id'>): ICanvasEdge | null => {
        let updatedEdge: ICanvasEdge | null = null;
        set((state) => {
          const edges = state.edges.map((e) => {
            if (e.id === edgeId) {
              updatedEdge = { ...e, ...edge };
              return updatedEdge;
            }
            return e;
          });
          return { edges };
        });
        return updatedEdge || null;
      },

      clearNodes: () => set({ nodes: [] }),
      clearEdges: () => set({ edges: [] }),

      clearAll: () => set({ nodes: [], edges: [] }),

    }),
    {
      name: 'canvas-graph-data-storage',
    },
  ),
)