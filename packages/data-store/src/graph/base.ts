import Graph, { MultiGraph } from "graphology";


// export interface IGraphBase {

// }


export class GraphBase {

  data: Graph;

  constructor() {
    this.data = new MultiGraph();
  }

  public getGraph(): Graph {
    return this.data;
  }


}