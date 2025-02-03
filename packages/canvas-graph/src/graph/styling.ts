import { Graph, GraphOptions, ThemeOptions } from '@antv/g6'
import { DEFAULT_EDGE_STYLE, DEFAULT_NODE_STYLE } from '../options/elements';


export class GraphStyling {

  graph!: Graph
  options!: Omit<GraphOptions, 'data'>

  constructor(graph: Graph, options: Omit<GraphOptions, 'data'>) {
    this.graph = graph;
    this.options = options;
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