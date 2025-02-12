

import {
  Graph,
  GraphOptions,
} from '@antv/g6';
import { GraphStore, ICanvasData, ICanvasNode } from '@invana/data-store'
import { convert_icanvas_edge_to_g6_edge, convert_icanvas_node_to_g6_node } from './style_utils';
import { GraphStyle } from './styling';
import { CanvasManagerOptions } from './types';
import { IGraphSchema } from '@invana/data-store/types/schema';
import { getUniqueItemsByItem } from './utils';
import { GraphCanvasUtils } from './canvas_utils';


export class CanvasManager {

  private graph!: Graph;
  store: GraphStore;
  styling: GraphStyle;
  canvas_utils: GraphCanvasUtils;
  private options: CanvasManagerOptions; // CanvasGraph options
  // private g6Options: GraphOptions // CanvasGraph options converted to G6 options


  constructor(graph: Graph, options: CanvasManagerOptions) {
    // console.log("CanvasManager.constructor", graph, options);
    this.graph = graph;
    this.options = options;
    this.styling = new GraphStyle(this.graph, this.options)
    this.store = new GraphStore();
    this.canvas_utils = new GraphCanvasUtils(this)
    this.initDataListeners();
    // set on first load 
    this.updateOptions(this.options)
  }

  getGraph(): Graph {
    // console.log("getGraph", this);
    return this.graph;
  }

  getGraphSchema(): IGraphSchema {
    return this.store.generateSchema();
  }

  getModelAsGraphData(): ICanvasData {
    const schema = this.getGraphSchema();
    // console.log("getModelAsGraphData.schema", schema);
    const nodes = schema.nodes.map(node => {
      // console.log("getModelAsGraphData.node", node)
      const properties = node.properties.reduce((acc: any, prop) => {
        acc[prop.name] = prop.type;
        return acc;
      }, {});

      return {
        id: node.name,
        type: node.name,
        label: node.name,
        properties: properties
      } as ICanvasNode
    })

    const edges = schema.edges.map(edge => {
      const properties = edge.properties.reduce((acc: any, prop) => {
        acc[prop.name] = prop.type;
        return acc;
      }, {});
      // console.log("getModelAsGraphData.edge", edge)
      return {
        id: edge.name,
        type: edge.name,
        label: edge.name,
        source: edge.source,
        target: edge.target,
        properties: properties
      }
    })
    return {
      nodes: nodes,
      edges: edges,
    }
  }



  updateOptions(options: CanvasManagerOptions, callback?: () => void) {
    console.log("updateOptions input options", options);

    let g6Options: GraphOptions = {}
    if (options.styles) {
      const styleOptions = this.styling.getUpdatedStylingOptions(options);
      g6Options = { ...g6Options, ...styleOptions, }
    }

    if (options.layout) {

      // console.log("updateOptions.options.layout", options.layout);
      g6Options['layout'] = options.layout || {};
      // Ensure layout.postLayout exists to avoid errors
      g6Options.layout.preLayout = false
      if (options.layout && typeof options.layout.postLayout !== 'function') {
        options.layout.postLayout = () => { };
      }
    }

    if (options.transforms) {
      g6Options['transforms'] = getUniqueItemsByItem(options.transforms || [])
    }

    if (options.plugins) {
      g6Options['plugins'] = getUniqueItemsByItem(options.plugins || [])
    }

    if (options.behaviors) {
      g6Options['behaviors'] = getUniqueItemsByItem(options.behaviors || [])
    }

    // console.log("CanvasManager.updateOptions", g6Options);

    const graph = this.getGraph();
    if (graph) {
      graph.setOptions(g6Options);
      graph.draw();
      if (options.layout) {
        // this.graph.layout()
        graph.render()
      }
    }
    this.options = { ...this.options, ...options };
    if (callback) {
      callback()
    }

  }

  setTheme(theme: string) {
    const newOptions: CanvasManagerOptions = {
      styles: {
        canvas: {
          theme: theme
        }
      }
    }
    this.updateOptions(newOptions)
  }

  initDataListeners() {


    // node
    this.store.data.on('nodeAdded', ({ key }) => {
      // console.log(`Node created: ${key}`);
      const node = this.store.fineNodeById(key);
      // console.log("node", node);
      if (node) {
        const g6Node = convert_icanvas_node_to_g6_node(node);
        // console.log("g6Node", g6Node);
        this.getGraph()?.addNodeData([g6Node])
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
        this.getGraph()?.addEdgeData([g6Edge])
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
      this.getGraph()?.clear();
    });
  }


  render() {
    const graph = this.getGraph();
    if (!graph.destroyed) {
      return this.getGraph().render();
    } else {
      return () => { }
    }
  }

}

export default GraphStore;
