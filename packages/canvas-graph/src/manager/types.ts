import { CanvasNodeStyle, ICanvasEdgeStyle, ICanvasStyle } from "@invana/data-store";


export interface ICanvasStyleOptions {
  nodes?: {
    [key: string]: Partial<CanvasNodeStyle>
  },
  edges?: {
    [key: string]: Partial<ICanvasEdgeStyle>
  },
  canvas?: Partial<ICanvasStyle>;
  defaultNode?: Partial<CanvasNodeStyle>;
  defaultEdge?: Partial<ICanvasEdgeStyle>;
}

export interface CanvasManagerOptions {
  styles?: ICanvasStyleOptions

}