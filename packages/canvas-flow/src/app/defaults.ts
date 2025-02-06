import { defaultNodeTypes } from "../templates/nodes"
import { FlowCanvasOptions } from "./types"
import { BackgroundVariant, ConnectionLineType, MarkerType } from "@xyflow/react"


export const DEFAULT_CANVAS_STYLE = {
    width: "100%",
    height: "100vh"
}


export const defaultFlowCanvasOptions: FlowCanvasOptions = {
    canvas: {
        colorMode: "system",
        minZoom: 0.1,
        maxZoom: 4,
        fitView: true,
        fitViewOptions: { padding: .2 },
        proOptions: { hideAttribution: true },
        defaultNodeOptions: {
            position: { x: 0, y: 0 },
            // sourcePosition: Position.Bottom,
            // targetPosition: Position.Top,
        },
        defaultEdgeOptions: {
            markerEnd: {
                type: MarkerType.ArrowClosed,
                // color: '#b1b1b7',
            }
        },
        connectionLineType: ConnectionLineType.Bezier,
        nodeTypes: defaultNodeTypes
    },
    nodes: [],
    edges: [],
    style: DEFAULT_CANVAS_STYLE,
    extraNodeTypes: {},
    extraEdgeTypes: {},
    layoutDirection: "LR",
    // debug: true,
    background: {
        variant: BackgroundVariant.Dots,
        color: "#4f4f4f",
        // size: 10,
        // color: "--color-neutral-800",
        // variant: BackgroundVariant.Lines,
        // color: "#2f2f2f"
    },
    display: {
        plugins: {
            devTools: true,
            miniMap: true,
            controls: true,
            background: true,
            theme: true
        }
    }
}