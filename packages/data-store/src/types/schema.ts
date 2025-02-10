

export interface ISchemaProperty {
  name: string;
  type: "string" | "number" | "boolean" | 'object' | string;
  required: boolean;
  defaultValue: any;
  description: string;

  // unique: boolean;
  // indexed: boolean;
  // properties: ISchemaProperty[];
}

export interface INodeSchema {
  name: string; // ex: Person, Entities
  properties: ISchemaProperty[];
}

export interface IEdgeSchema {
  name: string; // ex: Person, Entities
  properties: ISchemaProperty[];
  source: string;
  target: string;
  isDirected: boolean;
}

export interface IGraphSchema {
  nodes: INodeSchema[];
  edges: IEdgeSchema[];
}