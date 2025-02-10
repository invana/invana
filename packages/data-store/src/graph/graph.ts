import { IEdgeSchema, IGraphSchema, INodeSchema, ISchemaProperty } from '../types/schema';
import { GraphDataCRUD } from './crud';


export class GraphStore extends GraphDataCRUD {

  private nodeSchemas: Map<string, Map<string, ISchemaProperty>> = new Map();

  // private nodeSchemas: Map<string, INodeSchema> = new Map();
  private edgeSchemas: Map<string, IEdgeSchema> = new Map();

  // createNodeSchema(nodeSchema: INodeSchema) {
  //   this.nodeSchemas.set(nodeSchema.name, nodeSchema);
  // }

  // createEdgeSchema(edgeSchema: IEdgeSchema) {
  //   this.edgeSchemas.set(edgeSchema.name, edgeSchema);
  // }

  // getNodeSchema(label: string): INodeSchema | undefined {
  //   return this.nodeSchemas.get(label);
  // }

  // getEdgeSchema(label: string): IEdgeSchema | undefined {
  //   return this.edgeSchemas.get(label);
  // }

  generateSchema(): IGraphSchema {

    const graph = this.data;
    // Iterate through all nodes once
    graph.forEachNode((_, attributes) => {
      if (!attributes.type) return; // Skip nodes without a type
      console.log("attributes", attributes);
      const nodeProperties = attributes.properties || {};
      if (!this.nodeSchemas.has(attributes.type)) {
        this.nodeSchemas.set(attributes.type, new Map());
      }
      const schema = this.nodeSchemas.get(attributes.type)!;
      Object.keys(nodeProperties || {}).forEach((key) => {
        if (key === 'type') return;
        if (!schema.has(key)) {
          schema.set(key, {
            name: key,
            type: typeof nodeProperties[key],
            required: true,
            defaultValue: null,
            description: '',
          });
        }
      });
    });

    // Iterate through all edges once
    graph.forEachEdge((edge, attributes, source, target) => {
      console.log("<<edge", edge, attributes, source, target);

      const sourceNode = graph.getNodeAttributes(source);
      const targetNode = graph.getNodeAttributes(target);
      console.log("sourceNode", sourceNode, targetNode);
      if (!attributes.type) return; // Skip edges without a type
      const edgeProperties = attributes.properties || {};
      if (!this.edgeSchemas.has(attributes.type)) {
        this.edgeSchemas.set(attributes.type, {
          name: attributes.type,
          properties: [],
          source: sourceNode?.type,
          target: targetNode?.type,
          isDirected: graph.isDirected(edge),
        });
      }
      const schema = this.edgeSchemas.get(attributes.type)!;
      Object.keys(edgeProperties).forEach((key) => {
        if (key === 'type') return;
        if (!schema.properties.some((p) => p.name === key)) {
          schema.properties.push({
            name: key,
            type: typeof edgeProperties[key],
            required: true,
            defaultValue: null,
            description: '',
          });
        }
      });
    });
    return this.getGraphSchema();
  }

  // Get schema for the entire graph
  getGraphSchema(): IGraphSchema {
    return {
      nodes: Array.from(this.nodeSchemas.entries()).map(([name, properties]) => ({
        name,
        properties: Array.from(properties.values()),
      })),
      edges: Array.from(this.edgeSchemas.values()),
    };
  }

  // getSchemaForNode(nodeType: string): INodeSchema {
  //   const properties = this.nodeSchemas.get(nodeType);
  //   if (!properties) {
  //     throw new Error(`Node schema not found for type ${nodeType}`);
  //   }
  //   return {
  //     name: nodeType,
  //     properties: Array.from(properties.values()),
  //   };
  // }

}

