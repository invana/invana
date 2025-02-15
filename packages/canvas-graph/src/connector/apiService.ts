// APIService.ts

import { ICanvasEdge, ICanvasNode } from "@invana/data-store";


export type ICanvasNodeData = Omit<ICanvasNode, 'x' | 'y' | 'display' | 'combo'>;
export type ICanvasEdgeData = Omit<ICanvasEdge, 'display'>;


export class APIService {

  baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async createNode(node: ICanvasNode): Promise<any> {


    const query = `
{
  _run_query(query: "g.V().elementMap().limit(2).toList()", timeout: 10) {
    data
  }
}
`;

    const response = await fetch(`${this.baseUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    // if (!response.ok) throw new Error("Error creating node");
    if (!response.ok) throw new Error(`Error creating node: ${response.statusText}`);
    return response.json();
  }

  async updateNode(nodeId: string, updatedNode: Partial<ICanvasNodeData>): Promise<any> {
    const response = await fetch(`${this.baseUrl}/nodes/${nodeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedNode),
    });
    if (!response.ok) throw new Error("Error updating node");
    return response.json();
  }

  async deleteNode(nodeId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/nodes/${nodeId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Error deleting node");
    return response.json();
  }

  async createEdge(edge: ICanvasEdgeData): Promise<any> {
    const response = await fetch(`${this.baseUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edge),
    });
    if (!response.ok) throw new Error("Error creating edge");
    return response.json();
  }

  async updateEdge(edgeId: string, updatedEdge: Partial<ICanvasEdgeData>): Promise<any> {
    const response = await fetch(`${this.baseUrl}/edges/${edgeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedEdge),
    });
    if (!response.ok) throw new Error("Error updating edge");
    return response.json();
  }

  async deleteEdge(edgeId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/edges/${edgeId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Error deleting edge");
    return response.json();
  }

  // async createCombo(combo: IComboPayload): Promise<any> {
  //   const response = await fetch(`${this.baseUrl}/combos`, {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify(combo),
  //   });
  //   if (!response.ok) throw new Error("Error creating combo");
  //   return response.json();
  // }

  // async updateCombo(comboId: string, updatedCombo: Partial<IComboPayload>): Promise<any> {
  //   const response = await fetch(`${this.baseUrl}/combos/${comboId}`, {
  //     method: "PUT",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify(updatedCombo),
  //   });
  //   if (!response.ok) throw new Error("Error updating combo");
  //   return response.json();
  // }

  // async deleteCombo(comboId: string): Promise<any> {
  //   const response = await fetch(`${this.baseUrl}/combos/${comboId}`, {
  //     method: "DELETE",
  //   });
  //   if (!response.ok) throw new Error("Error deleting combo");
  //   return response.json();
  // }
}

// Export a singleton instance (adjust the base URL as needed)
// export default new APIService("https://api.example.com");