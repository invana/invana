import { ICanvasEdge, ICanvasNode } from '@invana/data-store'
import { create } from 'zustand'

// Define the interface for our zustand store
interface GraphStore {
  // Graph data
  nodes: ICanvasNode[]
  edges: ICanvasEdge[]

  // Local UI state (e.g., currently selected node)
  selectedNode: ICanvasNode | null

  // Actions to modify the store
  setGraphData: (nodes: ICanvasNode[], edges: ICanvasEdge[]) => void

  addData: (nodes: ICanvasNode[], edges: ICanvasEdge[]) => void

  addNode: (node: ICanvasNode) => void
  addEdge: (edge: ICanvasEdge) => void
  updateNode: (updatedNode: ICanvasNode) => void
  updateEdge: (updatedEdge: ICanvasEdge) => void
  removeNode: (nodeId: string) => void
  removeEdge: (edgeId: string) => void

  // UI-specific actions
  selectNode: (node: ICanvasNode) => void
  clearSelection: () => void
}

// Create the zustand store
const useGraphStore = create<GraphStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNode: null,

  setGraphData: (nodes, edges) => set({ nodes, edges }),
  addData: (nodes: ICanvasNode[], edges: ICanvasEdge[]) => {
    set(state => ({
      nodes: [...state.nodes, ...nodes],
      edges: [...state.edges, ...edges]
    }))
  },

  addNode: (node: ICanvasNode) =>
    set(state => ({
      nodes: [...state.nodes, node]
    })),

  addEdge: (edge: ICanvasEdge) =>
    set(state => ({
      edges: [...state.edges, edge]
    })),

  updateNode: (updatedNode: ICanvasNode) =>
    set(state => ({
      nodes: state.nodes.map(node =>
        node.id === updatedNode.id ? updatedNode : node
      )
    })),

  updateEdge: (updatedEdge: ICanvasEdge) =>
    set(state => ({
      edges: state.edges.map(edge =>
        edge.id === updatedEdge.id ? updatedEdge : edge
      )
    })),

  removeNode: (nodeId: string) =>
    set(state => ({
      nodes: state.nodes.filter(node => node.id !== nodeId),
      edges: state.edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId)
    })),

  removeEdge: (edgeId: string) =>
    set(state => ({
      edges: state.edges.filter(edge => edge.id !== edgeId)
    })),

  selectNode: (node: ICanvasNode) => set({ selectedNode: node }),
  clearSelection: () => set({ selectedNode: null })
}))

export default useGraphStore