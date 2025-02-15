// GraphStore.ts

import { create } from 'zustand';
import Graph from "graphology";
import { APIService } from "../connector/apiService";
import { ICanvasEdge, ICanvasItemID, ICanvasNode } from "@invana/data-store";

interface GraphStore {
  graph: Graph;

  // Node CRUD operations
  addNode: (node: ICanvasNode) => Promise<void>;
  updateNode: (nodeId: ICanvasItemID, updatedNode: Partial<ICanvasNode>) => Promise<void>;
  deleteNode: (nodeId: ICanvasItemID) => Promise<void>;

  // Edge CRUD operations
  addEdge: (edge: ICanvasEdge) => Promise<void>;
  updateEdge: (edgeId: ICanvasItemID, updatedEdge: Partial<ICanvasEdge>) => Promise<void>;
  deleteEdge: (edgeId: ICanvasItemID) => Promise<void>;

  // // Combo CRUD operations
  // addCombo: (combo: ICanvasNode) => Promise<void>;
  // updateCombo: (comboId: ICanvasItemID, updatedCombo: Partial<ICanvasNode>) => Promise<void>;
  // deleteCombo: (comboId: ICanvasItemID) => Promise<void>;

  // Local operations
  clearGraph: () => void;
}


const apiService = new APIService("http://localhost:8200");

export const useGraphStore = create<GraphStore>((set, get) => ({
  graph: new Graph({ multi: true, type: "mixed" }),

  // ---------------------------
  // Node operations
  // ---------------------------
  addNode: async (node: ICanvasNode) => {
    try {
      // First, persist via API
      await apiService.createNode(node);
      const graph = get().graph;
      if (!graph.hasNode(node.id)) {
        // Merge API-provided data if needed; here we simply add the node locally.
        graph.addNode(node.id, { ...node, isCombo: false });
        console.log("======", node)
        set({ graph });
      }
    } catch (error) {
      console.error("Failed to add node:", error);
    }
  },

  updateNode: async (nodeId: ICanvasItemID, updatedNode: Partial<ICanvasNode>) => {
    try {
      await apiService.updateNode(nodeId, updatedNode);
      const graph = get().graph;
      if (graph.hasNode(nodeId)) {
        graph.mergeNodeAttributes(nodeId, updatedNode);
        set({ graph });
      }
    } catch (error) {
      console.error("Failed to update node:", error);
    }
  },

  deleteNode: async (nodeId: ICanvasItemID) => {
    try {
      await apiService.deleteNode(nodeId);
      const graph = get().graph;
      if (graph.hasNode(nodeId)) {
        // Dropping a node removes its connected edges automatically.
        graph.dropNode(nodeId);
        set({ graph });
      }
    } catch (error) {
      console.error("Failed to delete node:", error);
    }
  },

  // ---------------------------
  // Edge operations
  // ---------------------------
  addEdge: async (edge: ICanvasEdge) => {
    try {
      await apiService.createEdge(edge);
      const graph = get().graph;
      if (!graph.hasEdge(edge.id)) {
        graph.addEdgeWithKey(edge.id, edge.source, edge.target, { ...edge });
        set({ graph });
      }
    } catch (error) {
      console.error("Failed to add edge:", error);
    }
  },

  updateEdge: async (edgeId: ICanvasItemID, updatedEdge: Partial<ICanvasEdge>) => {
    try {
      await apiService.updateEdge(edgeId, updatedEdge);
      const graph = get().graph;
      if (graph.hasEdge(edgeId)) {
        graph.mergeEdgeAttributes(edgeId, updatedEdge);
        set({ graph });
      }
    } catch (error) {
      console.error("Failed to update edge:", error);
    }
  },

  deleteEdge: async (edgeId: ICanvasItemID) => {
    try {
      await apiService.deleteEdge(edgeId);
      const graph = get().graph;
      if (graph.hasEdge(edgeId)) {
        graph.dropEdge(edgeId);
        set({ graph });
      }
    } catch (error) {
      console.error("Failed to delete edge:", error);
    }
  },

  // // ---------------------------
  // // Combo operations
  // // ---------------------------
  // addCombo: async (combo: ICanvasNode) => {
  //   try {
  //     await apiService.createCombo(combo);
  //     const graph = get().graph;
  //     if (!graph.hasNode(combo.id)) {
  //       // Mark as a combo by setting an extra flag
  //       graph.addNode(combo.id, { ...combo, isCombo: true });
  //       set({ graph });
  //     }
  //   } catch (error) {
  //     console.error("Failed to add combo:", error);
  //   }
  // },

  // updateCombo: async (comboId: ICanvasItemID, updatedCombo: Partial<ICanvasNode>) => {
  //   try {
  //     await apiService.updateCombo(comboId, updatedCombo);
  //     const graph = get().graph;
  //     if (graph.hasNode(comboId)) {
  //       const attributes = graph.getNodeAttributes(comboId);
  //       if (attributes.isCombo) {
  //         graph.mergeNodeAttributes(comboId, updatedCombo);
  //         set({ graph });
  //       } else {
  //         console.warn(`Node with id "${comboId}" is not marked as a combo.`);
  //       }
  //     }
  //   } catch (error) {
  //     console.error("Failed to update combo:", error);
  //   }
  // },

  // deleteCombo: async (comboId: ICanvasItemID) => {
  //   try {
  //     await apiService.deleteCombo(comboId);
  //     const graph = get().graph;
  //     if (graph.hasNode(comboId)) {
  //       const attributes = graph.getNodeAttributes(comboId);
  //       if (attributes.isCombo) {
  //         graph.dropNode(comboId);
  //         set({ graph });
  //       } else {
  //         console.warn(`Node with id "${comboId}" is not marked as a combo.`);
  //       }
  //     }
  //   } catch (error) {
  //     console.error("Failed to delete combo:", error);
  //   }
  // },

  // ---------------------------
  // Clear the entire graph
  // ---------------------------
  clearGraph: () => {
    const graph = get().graph;
    graph.clear();
    set({ graph });
  },
}));