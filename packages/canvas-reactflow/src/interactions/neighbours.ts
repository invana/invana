import { Edge } from "@xyflow/react";


export default class FindNeighbors {


    getNextIncomingEdges = (nodeId: string, edges: Edge[]) => {
        const incomingEdges = edges
            .filter((e) => e.target === nodeId)
            .map((e) => e);
        return incomingEdges;
    };

    getNextOutgoingEdges = (nodeId: string, edges: Edge[]) => {
        const outgoingEdges = edges
            .filter((e) => e.source === nodeId)
            .map((e) => e);
        return outgoingEdges;
    };

    getNextBothEdges = (nodeId: string, edges: Edge[]) => {
        return [...this.getNextIncomingEdges(nodeId, edges), ...this.getNextOutgoingEdges(nodeId, edges)]
    }

    // getNodeNextNeighbors = (nodeId: string, edges: CanvasEdge[], type?: "in" | "out" | "both" ) => {
    //     const allEdges = this.getNextBothEdges(nodeId, edges);
    //     const sourceNodeIds = allEdges.map((edge: Edge)=> edge.source)
    //     const targetNodeIds = allEdges.map((edge: Edge)=> edge.target)
    //     const nodeIds = [...new Set([...sourceNodeIds, ...targetNodeIds])]
    //     const edgeIds = allEdges.map((edge:Edge)=> edge.id);
    //     return {nodeIds, edgeIds}
    // }

}