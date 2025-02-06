import { GraphBase } from './base';
import { ICanvasData, ICanvasEdge, CanvasEdgeStyle, ICanvasItemID, ICanvasNode, CanvasNodeStyle, IProperties } from '../types';


export class GraphDataCRUD extends GraphBase {


  addData(data: ICanvasData, callback: () => void) {
    console.log("addData", data);
    data.nodes.forEach(node => {
      this.addNode(node);
    })
    data.edges.forEach(edge => {
      this.addEdge(edge);
    })
    if (callback) {
      callback();
    }
  }


  // Create a node
  addNode(node: ICanvasNode): void {
    const { id, ...attributes } = node;
    if (this.data.hasNode(id)) {
      throw new Error(`Node with id ${id} already exist.`);
    }
    this.data.addNode(id, attributes);
  }

  // Read a node
  fineNodeById(id: ICanvasItemID): ICanvasNode | undefined {
    if (!this.data.hasNode(id)) {
      throw new Error(`Node with id ${id} does not exist.`);
    }
    const attributes = this.data.getNodeAttributes(id);
    return { id, ...attributes } as ICanvasNode
  }

  // Update a node
  _updateNode(id: ICanvasItemID, attributes: Partial<Omit<ICanvasNode, 'id'>>): void {
    if (!this.data.hasNode(id)) {
      throw new Error(`Node with id ${id} does not exist.`);
    }
    this.data.mergeNodeAttributes(id, attributes);
  }

  updateNodeProperties(id: ICanvasItemID, properties: IProperties): void {
    if (!this.data.hasNode(id)) {
      throw new Error(`Node with id ${id} does not exist.`);
    }
    this._updateNode(id, { properties })
  }

  updateNodePosition(id: ICanvasItemID, x: number, y: number): void {
    if (!this.data.hasNode(id)) {
      throw new Error(`Node with id ${id} does not exist.`);
    }
    this._updateNode(id, { x, y })
  }

  updateNodeDisplay(id: ICanvasItemID, display: CanvasNodeStyle): void {
    if (!this.data.hasNode(id)) {
      throw new Error(`Node with id ${id} does not exist.`);
    }
    this._updateNode(id, { display })
  }

  // Delete a node
  deleteNode(id: ICanvasItemID): void {
    if (!this.data.hasNode(id)) {
      throw new Error(`Node with id ${id} does not exist.`);
    }
    this.data.dropNode(id);
  }

  // Create an edge
  addEdge(edge: ICanvasEdge): void {
    const { id, source, target, ...attributes } = edge;
    if (this.data.hasEdge(id)) {
      throw new Error(`Edge with id ${id} already exist.`);
    }
    this.data.addEdgeWithKey(id, source, target, attributes);
  }


  // Update an edge
  _updateEdge(id: ICanvasItemID, edge: Partial<Omit<ICanvasEdge, 'id' | 'source' | 'target'>>): void {
    if (!this.data.hasEdge(id)) {
      throw new Error(`Edge with id ${id} does not exist.`);
    }
    this.data.updateEdgeAttributes(id, (attributes) => ({
      ...attributes, // Retain existing attributes
      ...edge // Update with new attributes
    }));
  }

  updateEdgeProperties(id: ICanvasItemID, properties: IProperties): void {
    if (!this.data.hasEdge(id)) {
      throw new Error(`Edge with id ${id} does not exist.`);
    }
    this._updateEdge(id, { properties })
  }

  updateEdgeDisplay(id: ICanvasItemID, display: CanvasEdgeStyle): void {
    if (!this.data.hasEdge(id)) {
      throw new Error(`Edge with id ${id} does not exist.`);
    }
    this._updateEdge(id, { display })
  }

  // Read an edge
  fineEdgeById(id: ICanvasItemID): ICanvasEdge | undefined {
    if (!this.data.hasEdge(id)) {
      throw new Error(`Edge with id ${id} does not exist.`);
    }
    const source = this.data.source(id);
    const target = this.data.target(id);
    const attributes = this.data.getEdgeAttributes(id);
    return { id, source, target, ...attributes } as ICanvasEdge;
  }

  // Delete an edge
  deleteEdge(id: ICanvasItemID): void {
    if (!this.data.hasEdge(id)) {
      throw new Error(`Edge with id ${id} does not exist.`);
    }
    this.data.dropEdge(id);
  }
}

