import { ICanvasNode, ICanvasEdge, ICanvasData } from "@invana/data-store";
import { NodeData, EdgeData } from "@antv/g6";
import { CanvasNodeStyle, CanvasEdgeStyle, ICanvasStyle } from "@invana/data-store";
import { CanvasManager } from "./canvas/manager";


export type CanvasGraphNode = NodeData & { data?: ICanvasNode }

export type CanvasGraphEdge = EdgeData & { data?: ICanvasEdge }

export interface ICanvasStyleOptions {
  nodes?: {
    [key: string]: Partial<CanvasNodeStyle>
  },
  edges?: {
    [key: string]: Partial<CanvasEdgeStyle>
  },
  canvas?: Partial<ICanvasStyle>;
  defaultNode?: Partial<CanvasNodeStyle>;
  defaultEdge?: Partial<CanvasEdgeStyle>;
}

export interface CanvasGraphLayout {
  type: string;
  // key: string;
  [option: string]: string | object | number | boolean | undefined | null;
}

export interface CanvasGraphPlugin {
  type: string;
  key: string;
  [option: string]: string | object | number | boolean;
}

export interface CanvasGraphBehavior {
  type: string;
  [option: string]: string | object | number | boolean;
}

export interface CanvasGraphTransform {
  type: string;
  [option: string]: string | object | number | boolean;
}


export interface CanvasGraphOptions {
  styles?: ICanvasStyleOptions;
  plugins?: CanvasGraphPlugin[];
  behaviors?: CanvasGraphBehavior[];
  layout?: CanvasGraphLayout | undefined;
  transforms?: CanvasGraphTransform[];
}

export interface CanvasGraphProps {
  options: CanvasGraphOptions
  initData?: ICanvasData;
  className?: string;
  containerStyle?: React.CSSProperties;
  onReady?: (manager: CanvasManager) => void;
  onDestroy?: () => void;
  graphName?: string;

}