import { Edge, Node, ReactFlowInstance } from "@xyflow/react"
import CanvasInteractionActions from "./actions";


export type FlowInstanceType = ReactFlowInstance | undefined | null;
const canvasInteractionActions = new CanvasInteractionActions();


export default class CanvasInteractions {
    // https://reactflow.dev/docs/api/react-flow-props/
    onEdgeClick = (event: React.MouseEvent, edge: Edge, flowInstance?: FlowInstanceType) => {
        console.log("==onEdgeClick", event, edge, flowInstance, flowInstance?.getEdges());
        flowInstance?.setEdges((eds) =>
            eds.map((edg) => {
                if (edg.id === edge.id) {
                    edg.animated = true;
                }
                return edg;
            })
        );
    }
    // onEdgeDoubleClick = (event: React.MouseEvent, edge: Edge) => { }
    onEdgeMouseEnter = (event: React.MouseEvent, edge: Edge, flowInstance: FlowInstanceType) => {
        console.log("==onEdgeMouseEnter", event, edge, flowInstance, flowInstance?.getEdges());
        if (flowInstance) {
            canvasInteractionActions.highlightEdgeNeighbors(event, edge, flowInstance)
        }
    }
    onEdgeMouseLeave = (event: React.MouseEvent, edge: Edge, flowInstance: FlowInstanceType) => {
        console.log("==onEdgeMouseLeave", event, edge, flowInstance, flowInstance?.getEdges());
        if (flowInstance) {
            canvasInteractionActions.unHighlightEdgeNeighbors(event, edge, flowInstance)
        }
    }



    onNodeClick = (event: React.MouseEvent, edge: Edge) => { }
    onNodeDoubleClick = (event: React.MouseEvent, edge: Edge) => { }
    onNodeMouseEnter = (event: React.MouseEvent, node: Node, flowInstance: FlowInstanceType) => {
        console.log("==onNodeMouseEnter", node.id);
        if (flowInstance) { canvasInteractionActions.highlightNodeAndNeighbors(event, node, flowInstance) }
    }

    onNodeMouseLeave = (event: React.MouseEvent, node: Node, flowInstance: FlowInstanceType) => {
        console.log("==onNodeMouseLeave", node.id);
        if (flowInstance) { canvasInteractionActions.unHightlightNodeAndNeighbors(event, node, flowInstance) }
    }
    onNodeContextMenu = (event: React.MouseEvent, node: Node) => {


    }

    // onEdgeContextMenu = (event: React.MouseEvent, edge: Edge) => { }



    // onSelectionContextMenu = (event: React.MouseEvent, nodes: Node[]) => { }


    onPaneClick = (event: React.MouseEvent, flowInstance: FlowInstanceType) => { // Called when user clicks directly on the canvas

    }


}