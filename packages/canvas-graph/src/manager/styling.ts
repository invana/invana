import { EdgeOptions, Graph, GraphOptions, NodeOptions, ThemeOptions } from '@antv/g6'
import { DEFAULT_EDGE_STYLE, DEFAULT_NODE_STYLE } from '../options/elements';
import { CanvasManagerOptions, ICanvasStyleOptions } from './types';
import { convert_edge_canvas_style_to_g6_sytle, convert_node_canvas_style_to_g6_style } from './utils';
import { defaultEdgeStyle, defaultNodeStyle } from './defaults';


export class GraphStyle {

  graph!: Graph
  options!: CanvasManagerOptions

  constructor(graph: Graph, options: CanvasManagerOptions) {
    console.log("GraphStyle.constructor", graph, options);
    this.graph = graph;
    this.options = options;
    this.init();
  }

  init() {
    const theme = this.options.styles?.canvas?.theme ?? 'system';
    const options: GraphOptions = { theme };

    const defaultNodeStyle = convert_node_canvas_style_to_g6_style(this.options?.styles?.defaultNode ?? {});
    options.node = defaultNodeStyle as NodeOptions;

    const defaulEdgeStyle = convert_edge_canvas_style_to_g6_sytle(this.options?.styles?.defaultEdge ?? {});
    options.edge = defaulEdgeStyle as EdgeOptions
    this.graph.setOptions(options)
  }

  defaultNodeStyleBasedOnTheme = (theme: ThemeOptions) => {
    const style = { ...DEFAULT_NODE_STYLE };
    if (!style.state) {
      style.state = {};
    }
    if (!style.state.dim) {
      style.state.dim = {};
    }

    const dimLabelFill = theme === 'dark' ? '#242424' : '#aaaaaa'
    const dimFill = theme === 'dark' ? '#242424' : '#aaaaaa';

    style.state.dim = {
      ...style.state.dim,
      fill: dimFill,
      labelFill: dimLabelFill
    };

    return style
  }

  defaultEdgeStyleBasedOnTheme = (theme: ThemeOptions) => {
    const style = { ...DEFAULT_EDGE_STYLE };
    if (!style.state) {
      style.state = {};
    }
    if (!style.state.dim) {
      style.state.dim = {};
    }

    const dimLabelFill = theme === 'dark' ? '#242424' : '#aaaaaa'
    const dimStroke = theme === 'dark' ? '#242424' : '#aaaaaa';

    style.state.dim = {
      ...style.state.dim,
      stroke: dimStroke,
      labelFill: dimLabelFill
    };

    return style
  }

  setTheme(theme: ThemeOptions) {
    const nodeStyle = this.defaultNodeStyleBasedOnTheme(theme);
    const edgeStyle = this.defaultEdgeStyleBasedOnTheme(theme);

    this.graph.setOptions({
      theme,
      node: nodeStyle,
      edge: edgeStyle
    })
    // this.graph.setTheme(theme)
    // // update node styling
    // this.graph.setNode(nodeStyle);
    // // update edge styling
    // this.graph.setEdge(edgeStyle)
    // this.graph.refresh();
  }

}