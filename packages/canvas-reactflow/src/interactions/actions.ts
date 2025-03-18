import { Edge, Node, ReactFlowInstance } from "@xyflow/react";
import FindNeighbors from "./neighbours";

const findNeighbors = new FindNeighbors()

export default class CanvasInteractionActions {

    highlightNodeAndNeighbors = (event: React.MouseEvent, node: Node, flowInstance: ReactFlowInstance) => {
        const edges = flowInstance.getEdges();
        const allEdges = findNeighbors.getNextBothEdges(node.id, edges);
        allEdges.forEach((edge: Edge) => {
            this.highlightEdgeNeighbors(event, edge, flowInstance);
        })
    }

    unHightlightNodeAndNeighbors = (event: React.MouseEvent, node: Node, flowInstance: ReactFlowInstance) => {
        const edges = flowInstance.getEdges();
        const allEdges = findNeighbors.getNextBothEdges(node.id, edges);
        allEdges.forEach((edge: Edge) => {
            this.unHighlightEdgeNeighbors(event, edge, flowInstance)
        })
    }

    highlightEdgeNeighbors = (_event: React.MouseEvent, edge: Edge, flowInstance: ReactFlowInstance) => {
        this.highlightNode(flowInstance.getNode(edge.source) as Node, flowInstance);
        this.highlightNode(flowInstance.getNode(edge.target) as Node, flowInstance);
        this.highlightEdge(edge, flowInstance)
    }

    unHighlightEdgeNeighbors = (_event: React.MouseEvent, edge: Edge, flowInstance: ReactFlowInstance) => {
        this.unHighlightNode(flowInstance.getNode(edge.source) as Node, flowInstance);
        this.unHighlightNode(flowInstance.getNode(edge.target) as Node, flowInstance);
        this.unHighlightEdge(edge, flowInstance);
    }

    highlightNode = (node: Node, flowInstance: ReactFlowInstance) => {
        console.log("highlightNode flowInstance", flowInstance)
        const el = document.querySelector(".react-flow__node[data-id='" + node.id + "']") as HTMLElement;
        if (el) {
            el.style.borderColor = "green";
            // el.style.borderStyle = "dashed";
        }
    }

    unHighlightNode = (node: Node, flowInstance: ReactFlowInstance) => {
        console.log("highlightNode flowInstance", flowInstance)
        const el = document.querySelector(".react-flow__node[data-id='" + node.id + "']") as HTMLElement;
        if (el) {
            el.style.borderColor = "var(--canvas-border)";
            // el.style.borderStyle = "solid";
        }
    }

    highlightEdge = (edge: Edge, flowInstance: ReactFlowInstance) => {
        flowInstance?.setEdges((eds) =>
            eds.map((edg) => {
                if (edg.id === edge.id) {
                    edg.style = { strokeWidth: 2 };
                    edg.animated = true
                }
                return edg;
            })
        );
    }

    unHighlightEdge = (edge: Edge, flowInstance: ReactFlowInstance) => {
        flowInstance?.setEdges((eds) =>
            eds.map((edg) => {
                if (edg.id === edge.id) {
                    // edg.style = { stroke: "#ccc" };
                    edg.style = { strokeWidth: 1 };

                    edg.animated = false
                }
                return edg;
            })
        );
    }






    // showNodeContextMenu

    // showEdgeContextMenu

    // hideNodeContextMenu

    // hideEdgeContextMenu



}