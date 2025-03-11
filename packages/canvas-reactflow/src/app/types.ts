import type { ReactNode, CSSProperties } from "react";
import {
  Node, Edge, NodeTypes, EdgeTypes, ReactFlowProps as ReactFlowPropsOriginal,
  BackgroundProps,
  ReactFlowInstance
} from "@xyflow/react"


export interface ReactFlowProps extends ReactFlowPropsOriginal {
  defaultNodeOptions?: Partial<Node>;
}

export interface CanvasPlugin {
  name: string;
  component: ReactNode;
  options: {
    [key: string]: string | boolean | number;
  };
  isHidden: boolean;
}

export type LayoutDirections = "TB" | "LR" | "BT" | "RL" | undefined

export interface FlowCanvasOptions {
  ref?: React.MutableRefObject<ReactFlowInstance | null>
  canvas?: Omit<ReactFlowProps, "nodes" | "edges">;
  children?: ReactNode;
  style?: CSSProperties;
  // data
  nodes: Node[];
  edges: Edge[];
  // templates
  extraNodeTypes?: NodeTypes;
  extraEdgeTypes?: EdgeTypes;
  // layout
  layoutDirection?: LayoutDirections;
  debug?: boolean;
  background?: BackgroundProps;
  display?: {
    plugins: { [key: string]: boolean; }
  }
}