import { CanvasEdgeStyle, CanvasNodeStyle } from "./display";

export type IPropertiesData = string | number | boolean | object | IPropertiesData[];


export interface IProperties {
  [key: string]: IPropertiesData
}

export type ICanvasItemID = string;

export interface ICanvasElement {
  id: ICanvasItemID | string;
  type: string; // ex: Person, Entities
  label?: string; // this will be the display label; not the node label
  properties: IProperties;
  // displayLabel?: string;
}

export interface ICanvasNode extends ICanvasElement {
  x?: number;
  y?: number;
  display?: CanvasNodeStyle;
}

export interface ICanvasEdge extends ICanvasElement {
  source: string;
  target: string;
  display?: CanvasEdgeStyle
}

export interface ICanvasData {
  nodes: ICanvasNode[];
  edges: ICanvasEdge[];
}
