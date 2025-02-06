import { CanvasNodeStyle, CanvasEdgeStyle, ICanvasStyle } from "@invana/data-store";


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
  [option: string]: string | object | number | boolean;
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

export interface CanvasManagerOptions {
  styles?: ICanvasStyleOptions;
  plugins?: CanvasGraphPlugin[];
  behaviors?: CanvasGraphBehavior[];
  layout?: CanvasGraphLayout | undefined;
  transforms?: CanvasGraphTransform[];
}