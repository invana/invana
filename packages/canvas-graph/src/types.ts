import { ICanvasNode, ICanvasEdge } from "@invana/data-store";
import { NodeData, EdgeData } from "@antv/g6";


export type CanvasGraphNode = NodeData & { data?: ICanvasNode }

export type CanvasGraphEdge = EdgeData & { data?: ICanvasEdge }