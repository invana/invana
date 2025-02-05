import { EdgeOptions, Graph, GraphOptions, NodeOptions, ThemeOptions } from '@antv/g6'
import { CanvasManagerOptions } from './types';
import { convert_canvas_style_to_g6_style, convert_edge_canvas_style_to_g6_sytle, convert_node_canvas_style_to_g6_style } from './utils';
import { ICanvasStyle, mergeDeep } from '@invana/data-store';
import { NodeStyle } from '@antv/g6/lib/spec/element/node';
import { EdgeStyle } from '@antv/g6/lib/spec/element/edge';


export class GraphStyle {

  private graph!: Graph
  private options!: CanvasManagerOptions

  constructor(graph: Graph, options: CanvasManagerOptions) {
    console.log("GraphStyle.constructor", graph, options.styles);
    this.graph = graph;
    this.options = options;
    this.updateDefaults(this.options);
  }



  private getUpdatedDefaultNodeStyle = (options: CanvasManagerOptions, theme: string): NodeStyle => {
    return convert_node_canvas_style_to_g6_style(
      options?.styles?.defaultNode ?? {},
      theme as string
    )
  }

  private getUpdatedDefaultEdgeStyle = (options: CanvasManagerOptions, theme: string): EdgeStyle => {
    return convert_edge_canvas_style_to_g6_sytle(
      options?.styles?.defaultEdge ?? {},
      theme as string
    );
  }

  private updateOptions = (options: CanvasManagerOptions) => {
    this.options = options;
  }


  updateDefaults(newOptions: CanvasManagerOptions) {

    // update existing options with the new options 
    const options: CanvasManagerOptions = mergeDeep(this.options, newOptions);

    let graphOptions: GraphOptions = {}

    // canvas styling
    if (newOptions.styles?.canvas) {
      const canvasStyle = convert_canvas_style_to_g6_style(options?.styles?.canvas as ICanvasStyle ?? {});
      graphOptions = { ...canvasStyle, ...graphOptions };
    }

    // default node styling
    if (newOptions.styles?.defaultNode) {
      const DEFAULT_NODE_STYLE = this.getUpdatedDefaultNodeStyle(options, options?.styles?.canvas?.theme as string);
      graphOptions.node = DEFAULT_NODE_STYLE as NodeOptions
    }


    // default edge styling
    if (newOptions.styles?.defaultEdge) {
      const defaulEdgeStyle = this.getUpdatedDefaultEdgeStyle(options, options?.styles?.canvas?.theme as string);
      graphOptions.edge = defaulEdgeStyle as EdgeOptions
    }

    // update location options variable
    this.updateOptions(options);
    // update graph graphOptions
    console.log("graphOptions", graphOptions)
    this.graph.setOptions(graphOptions)
  }

  // defaultNodeStyleBasedOnTheme = (theme: ThemeOptions) => {
  //   const style = { ...DEFAULT_NODE_STYLE };
  //   if (!style.state) {
  //     style.state = {};
  //   }
  //   if (!style.state.dim) {
  //     style.state.dim = {};
  //   }
  //   const dimLabelFill = theme === 'dark' ? '#242424' : '#aaaaaa'
  //   const dimFill = theme === 'dark' ? '#242424' : '#aaaaaa';
  //   style.state.dim = {
  //     ...style.state.dim,
  //     fill: dimFill,
  //     labelFill: dimLabelFill
  //   };

  //   return style
  // }

  // defaultEdgeStyleBasedOnTheme = (theme: ThemeOptions) => {
  //   const style = { ...DEFAULT_EDGE_STYLE };
  //   if (!style.state) {
  //     style.state = {};
  //   }
  //   if (!style.state.dim) {
  //     style.state.dim = {};
  //   }

  //   const dimLabelFill = theme === 'dark' ? '#242424' : '#aaaaaa'
  //   const dimStroke = theme === 'dark' ? '#242424' : '#aaaaaa';

  //   style.state.dim = {
  //     ...style.state.dim,
  //     stroke: dimStroke,
  //     labelFill: dimLabelFill
  //   };

  //   return style
  // }

  setTheme(theme: ThemeOptions) {
    // const nodeStyle = this.defaultNodeStyleBasedOnTheme(theme);
    // const edgeStyle = this.defaultEdgeStyleBasedOnTheme(theme);

    // this.graph.setOptions({
    //   theme,
    //   node: nodeStyle,
    //   edge: edgeStyle
    // })
    this.updateDefaults()
    // this.graph.setTheme(theme)
    // // update node styling
    // this.graph.setNode(nodeStyle);
    // // update edge styling
    // this.graph.setEdge(edgeStyle)
    // this.graph.refresh();
  }

}