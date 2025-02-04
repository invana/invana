import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NodeData, EdgeData, ComboData, NodeOptions, EdgeOptions, CanvasOptions } from '@antv/g6';


export type ThemeOptions = 'dark' | 'light' | 'system';

export interface CanvasGraphState {
  theme: ThemeOptions;
  setTheme: (theme: ThemeOptions) => void;

  // graph data starts
  nodes: NodeData[];
  edges: EdgeData[];
  combos: ComboData[];

  addNode: (node: NodeData) => void;
  addEdge: (edge: EdgeData) => void;
  addCombo: (combo: ComboData) => void;

  updateNode: (node: NodeData) => void;
  updateEdge: (edge: EdgeData) => void;
  updateCombo: (combo: ComboData) => void;

  removeNode: (node: NodeData) => void;
  removeEdge: (edge: EdgeData) => void;
  removeCombo: (combo: ComboData) => void;
  // graph data ends

  // extra annotations starts
  selectedData: { nodes: NodeData[], edges: EdgeData[], combos: ComboData[] };
  setSelectedData: (nodes: NodeData[], edges: EdgeData[], combos: ComboData[]) => void;

  taggedNodes: NodeData[];
  setTaggedNodes: (nodes: NodeData[]) => void;


  animateData: { nodes: NodeData[], edges: EdgeData[] };
  setAnimateData: (nodes: NodeData[], edges: EdgeData[]) => void;
  /// extra annotations ends

  clear: () => void;

  // styling starts 
  nodeSettings: NodeOptions[],
  setNodeSettings: (settings: NodeOptions[]) => void;

  edgeSettings: EdgeOptions[],
  setEgdeSettings: (settings: EdgeOptions[]) => void,

  canvasSettings: CanvasOptions,
  setCanvasSettings: (settings: CanvasOptions) => void;
  // styling ends
}

const storeName = 'canvas-graph-store';

export const useCanvasGraphStore = create(
  persist<CanvasGraphState>(
    (set) => ({
      theme: 'dark',
      setTheme: (theme: ThemeOptions) => {
        set({ theme })
      },

      nodes: [],
      addNode: (node: NodeData) => {
        set((state) => ({ nodes: [...state.nodes, node] }))
      },

      edges: [],
      addEdge: (edge: EdgeData) => {
        set((state) => ({ edges: [...state.edges, edge] }))
      },

      combos: [],
      addCombo: (combo: ComboData) => {
        set((state) => ({ combos: [...state.combos, combo] }))
      },

      clear: () => set({ nodes: [], edges: [], combos: [] }),

      nodeSettings: [],
      setNodeSettings: (settings: NodeOptions[]) => {
        set({ nodeSettings: settings })
      },

      edgeSettings: [],
      setEgdeSettings: (settings: EdgeOptions[]) => {
        set({ edgeSettings: settings })
      },

      canvasSettings: {},
      setCanvasSettings: (settings: CanvasOptions) => {
        set({ canvasSettings: settings })
      }

    }),
    {
      name: storeName
    }
  )
);