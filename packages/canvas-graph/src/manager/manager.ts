

import {
  Graph,
  GraphOptions,
} from '@antv/g6';
import { GraphStore } from '@invana/data-store'
import { convert_icanvas_edge_to_g6_edge, convert_icanvas_node_to_g6_node } from './utils';
import { GraphStyle } from './styling';
import { CanvasGraphBehavior, CanvasGraphPlugin, CanvasGraphTransform, CanvasManagerOptions } from './types';


export class CanvasManager {

  private graph!: Graph;
  store: GraphStore;
  styling: GraphStyle
  private options: CanvasManagerOptions // CanvasGraph options
  // private g6Options: GraphOptions // CanvasGraph options converted to G6 options


  constructor(graph: Graph, options: CanvasManagerOptions) {
    console.log("CanvasManager.constructor", graph, options);
    this.graph = graph;
    this.options = options;
    this.styling = new GraphStyle(this.graph, this.options)
    this.store = new GraphStore();
    this.initDataListeners();
    // set on first load 
    this.updateOptions(this.options)
  }

  getGraph(): Graph {
    console.log("getGraph", this);
    return this.graph;
  }

  getUniqueItemsByItem(options: CanvasGraphPlugin[] | CanvasGraphBehavior[] | CanvasGraphTransform[]) {
    const uniqueItems = options.reduce((acc, item) => {
      acc[item.type] = item
      return acc
    }, {} as Record<string, CanvasGraphPlugin | CanvasGraphBehavior | CanvasGraphTransform>)
    return Object.values(uniqueItems)
  }

  updateOptions(options: CanvasManagerOptions, callback?: () => void) {
    console.log("updateOptions input options", options);

    let g6Options: GraphOptions = {}
    if (options.styles) {
      const styleOptions = this.styling.getUpdatedStylingOptions(options);
      g6Options = { ...g6Options, ...styleOptions, }
    }

    if (options.layout) {

      console.log("updateOptions.options.layout", options.layout);
      g6Options['layout'] = options.layout || {}
    }

    if (options.transforms) {
      g6Options['transforms'] = this.getUniqueItemsByItem(options.transforms || [])
    }

    if (options.plugins) {
      g6Options['plugins'] = this.getUniqueItemsByItem(options.plugins || [])
    }

    if (options.behaviors) {
      g6Options['behaviors'] = this.getUniqueItemsByItem(options.behaviors || [])
    }

    console.log("CanvasManager.updateOptions", g6Options);

    this.graph.setOptions(g6Options);
    this.graph.draw();
    if (options.layout) {
      this.graph.layout()
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
    return this.graph.render();
  }

}

export default GraphStore;
