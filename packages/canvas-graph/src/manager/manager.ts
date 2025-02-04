

import {
  Graph,
  GraphOptions
} from '@antv/g6';
import { GraphStore } from '@invana/data-store/index'
import { convert_icanvas_edge_to_g6_edge, convert_icanvas_node_to_g6_node } from './utils';
import { GraphStyle } from './styling';


export class CanvasManager {

  private graph!: Graph;
  store: GraphStore;
  styling!: GraphStyle

  constructor(graph: Graph, options: GraphOptions) {
    this.graph = graph;
    this.styling = new GraphStyle(this.graph, options)
    this.store = new GraphStore();
    this.initDataListeners();
  }

  getGraph(): Graph {
    return this.graph;
  }

  // /** Set theme */
  // setTheme(theme: 'light' | 'dark') {
  //   this.graph.setOptions({ theme });
  //   // const themeConfig = theme === 'light'
  //   //   ? { defaultNode: { style: { fill: '#fff', stroke: '#000' } } }
  //   //   : { defaultNode: { style: { fill: '#333', stroke: '#fff' } } };

  //   // this.graph.updateItem('global', themeConfig);
  //   // this.graph.refresh();
  // }


  initDataListeners() {

    // node
    this.store.data.on('nodeAdded', ({ key }) => {
      // console.log(`Node created: ${key}`);
      const node = this.store.fineNodeById(key);
      // console.log("node", node);
      if (node) {
        const g6Node = convert_icanvas_node_to_g6_node(node);
        // console.log("g6Node", g6Node);
        this.graph.addNodeData([g6Node])
      }
    });

    this.store.data.on('nodeDropped', (nodeKey) => {
      console.log(`Node deleted: ${nodeKey}`);
    });

    this.store.data.on('nodeAttributesUpdated', (nodeKey) => {
      console.log(`Node updated: ${nodeKey}`);
    });

    // edge
    this.store.data.on('edgeAdded', ({ key }) => {
      // console.log(`Edge created: ${key}`);
      const edge = this.store.fineEdgeById(key);
      // console.log("edge", edge);
      if (edge) {
        const g6Edge = convert_icanvas_edge_to_g6_edge(edge);
        // console.log("g6Edge", g6Edge);
        this.graph.addEdgeData([g6Edge])
      }
    });

    this.store.data.on('edgeDropped', (edgeKey) => {
      console.log(`Edge deleted: ${edgeKey}`);
    });

    this.store.data.on('edgeAttributesUpdated', (edgeKey) => {
      console.log(`Edge updated: ${edgeKey}`);
    });

    // graph
    this.store.data.on('cleared', () => {
      console.log(`Graph cleared`);
    });
  }

  render() {
    this.graph.render();
  }




  // updateData(data: GraphData) {

  // }

  // removeData(dataIds: { nodes: ID[], edges: ID[], combos: ID[] }) {
  //   if (dataIds.edges) this.graph.removeEdgeData(dataIds.edges);
  //   if (dataIds.nodes) this.graph.removeNodeData(dataIds.nodes);
  //   if (dataIds.combos) this.graph.removeComboData(dataIds.combos);
  //   this.graph.render();
  // }

  // updateNodeData(nodes: NodeData[]) {
  //   this.graph.updateNodeData(nodes);
  //   this.graph.render();
  // }

  // setGraphData(data: { nodes: NodeData[]; edges: EdgeData[] }) {
  //   this.graph.setData(data);
  //   this.graph.render();

  // }
}

export default GraphStore;
