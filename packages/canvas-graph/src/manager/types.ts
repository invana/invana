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

export interface CanvasManagerOptions {
  styles?: ICanvasStyleOptions;
  // behaviors?: object[];
}