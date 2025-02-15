import { GraphStore, ICanvasData, ICanvasEdge, ICanvasNode } from "@invana/data-store";
import { IGraphSchema } from "@invana/data-store/types/schema";
import { create } from "zustand";
import { persist } from "zustand/middleware";


export interface CanvasGraphDataState {

  graphStore: GraphStore

  // for data 
  // nodes: ICanvasNode[];
  // edges: ICanvasEdge[];

  // addNodes: (nodes: ICanvasNode[]) => void;
  // addEdges: (edges: ICanvasEdge[]) => void;

  addData: (data: ICanvasData, callback: () => void) => void;

  // removeNodesByIds: (nodeIds: string[]) => void;
  // removeEdgesByIds: (edgeIds: string[]) => void;

  updateNode: (nodeId: string, node: Omit<ICanvasNode, 'id'>) => void
  updateEdge: (edgeId: string, edge: Omit<ICanvasEdge, 'id'>) => void

  clear: () => void;

  getGraphSchema: () => IGraphSchema;

  // updateNodeSchema: (nodeType: string, nodeSchema: INodeSchema) => void;
  // updateEdgeSchema: (edgeType: string, edgeSchema: IEdgeSchema) => void;

  // deleteNodeSchema: (nodeType: string) => void;
  // deleteEdgeSchema: (edgeType: string) => void;

  // getNodeSchema: (nodeType: string) => INodeSchema | null;
  // getEdgeSchema: (edgeType: string) => IEdgeSchema | null;

}


export const useCanvasGraphDataStore = create(
  persist<CanvasGraphDataState>(
    (set, get) => ({
      graphStore: new GraphStore(),

      // nodes: [],
      // edges: [],
      // nodeSchema: {},
      // edgeSchema: {},
      getGraphSchema: () => {
        return get().graphStore.generateSchema();
      },

      addData: (data, callback) => {
        set((state) => {
          state.graphStore.addData(data, callback);
          return { graphStore: state.graphStore };
        })
      },
      // addNodes: (nodes: ICanvasNode[]) => set((state) => ({ nodes: [...state.nodes, ...nodes] })),
      // addEdges: (edges: ICanvasEdge[]) => set((state) => ({ edges: [...state.edges, ...edges] })),

      // removeNodesByIds: (nodeIds: string[]) => set((state) => ({ nodes: state.nodes.filter(node => !nodeIds.includes(node.id)) })),
      // removeEdgesByIds: (edgeIds: string[]) => set((state) => ({ edges: state.edges.filter(edge => !edgeIds.includes(edge.id)) })),

      updateNode: (nodeId: string, node: Omit<ICanvasNode, 'id'>) => {
        set((state) => {
          state.graphStore.updateNodeProperties(nodeId, node);
          return { graphStore: state.graphStore };
        });
      },

      updateEdge: (edgeId: string, edge: Omit<ICanvasEdge, 'id'>) => {
        set((state) => {
          state.graphStore.updateEdgeProperties(edgeId, edge);
          return { graphStore: state.graphStore };
        });
      },

      clear: () => set((state) => {
        state.graphStore.clear();
        return { graphStore: state.graphStore };
      }),

      //
      // updateNodeSchema: (nodeType: string, nodeSchema: INodeSchema) => set((state) => ({
      //   nodeSchema: { ...state.nodeSchema, [nodeType]: nodeSchema }
      // })),
      // updateEdgeSchema: (edgeType: string, edgeSchema: IEdgeSchema) => set((state) => ({
      //   edgeSchema: { ...state.edgeSchema, [edgeType]: edgeSchema }
      // })),
      // deleteNodeSchema: (nodeType: string) => set((state) => {
      //   const { [nodeType]: _, ...nodeSchema } = state.nodeSchema;
      //   return { nodeSchema };
      // }),
      // deleteEdgeSchema: (edgeType: string) => set((state) => {
      //   const { [edgeType]: deleted, ...edgeSchema } = state.edgeSchema;
      //   return { edgeSchema };
      // }),
      // getNodeSchema: (nodeType: string) => get().nodeSchema[nodeType] || null,
      // getEdgeSchema: (edgeType: string) => get().edgeSchema[edgeType] || null,


    }),
    {
      name: 'canvas-graph-data-storage',
    },
  ),
)