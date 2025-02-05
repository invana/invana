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




export interface CanvasGraphPlugin {
  key: string;
  [option: string]: string | object | number | boolean;
}

export interface CanvasGraphBehavior {
  key: string;
  [option: string]: string | object | number | boolean;
}

export interface CanvasGraphTransform {
  key: string;
  [option: string]: string | object | number | boolean;
}

export interface CanvasManagerOptions {
  styles?: ICanvasStyleOptions;
  plugins?: CanvasGraphPlugin[];
  behaviors?: CanvasGraphBehavior[];
  transforms?: CanvasGraphTransform[];
}