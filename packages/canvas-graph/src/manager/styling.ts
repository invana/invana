import { EdgeOptions, Graph, GraphOptions, NodeOptions } from '@antv/g6'
import { CanvasManagerOptions } from './types';
import {
  convert_canvas_style_to_g6_style,
  convert_edge_canvas_style_to_g6_sytle,
  convert_node_canvas_style_to_g6_style
} from './utils';
import { ICanvasStyle, mergeDeep } from '@invana/data-store';
import { NodeStyle } from '@antv/g6/lib/spec/element/node';
import { EdgeStyle } from '@antv/g6/lib/spec/element/edge';


export class GraphStyle {

  private graph: Graph
  private options!: CanvasManagerOptions

  constructor(graph: Graph, options: CanvasManagerOptions) {
    console.log("GraphStyle.constructor", graph, options.styles);
    this.graph = graph;
    this.options = options;
  }

  private getUpdatedDefaultNodeStyle = (options: CanvasManagerOptions, theme: string): NodeStyle => {
    const nodeStyle: NodeStyle = convert_node_canvas_style_to_g6_style(
      options
    )
    if (nodeStyle.style) {
      delete (nodeStyle.style as { fill?: string }).fill;
    }

    nodeStyle.palette = {
      type: 'group',
      field: 'type',
    };
    return nodeStyle
  }

  private getUpdatedDefaultEdgeStyle = (options: CanvasManagerOptions): EdgeStyle => {

    const edgeStyle: EdgeStyle = convert_edge_canvas_style_to_g6_sytle(
      options
    );

    if (edgeStyle.style) {
      delete (edgeStyle.style as { stroke?: string }).stroke;
    }
    edgeStyle.palette = {
      type: 'group',
      field: 'type',
    };
    return edgeStyle
  }

  getUpdatedStylingOptions(newOptions: CanvasManagerOptions): GraphOptions {
    // update existing options with the new options 
    const options: CanvasManagerOptions = mergeDeep(this.options, newOptions);
    // console.log("getUpdatedStylingOptions.options", JSON.stringify(options, null, 4))

    let graphOptions: GraphOptions = {}

    // canvas styling
    if (newOptions.styles?.canvas) {
      const canvasStyle = convert_canvas_style_to_g6_style(options?.styles?.canvas as ICanvasStyle ?? {});
      graphOptions = { ...canvasStyle, ...graphOptions };
    }

    // default node styling
    if (newOptions.styles?.defaultNode || newOptions.styles?.canvas?.theme) {
      const DEFAULT_NODE_STYLE = this.getUpdatedDefaultNodeStyle(options, options?.styles?.canvas?.theme as string);
      graphOptions.node = DEFAULT_NODE_STYLE as NodeOptions
    }

    // default edge styling
    if (newOptions.styles?.defaultEdge || newOptions.styles?.canvas?.theme) {
      const defaulEdgeStyle = this.getUpdatedDefaultEdgeStyle(options, options?.styles?.canvas?.theme as string);
      graphOptions.edge = defaulEdgeStyle as EdgeOptions
    }

    console.log("graphOptions", graphOptions)
    // this.graph.setOptions(graphOptions)
    return graphOptions
  }


  hideAllNodes() {
    this.graph.getNodeData().forEach((node) => this.graph.hideElement(node.id))
  }

  showAllNodes() {
    this.graph.getNodeData().forEach((node) => this.graph.showElement(node.id))
  }

  hideAllEdges() {
    console.log("this.graph.getEdgeData() called")
    this.graph.getEdgeData().forEach((edge) => {
      if (edge?.id) {
        this.graph.hideElement(edge.id);
      }
    });
  }

  showAllEdges() {
    this.graph.getEdgeData().forEach((edge) => {
      if (edge?.id) {
        this.graph.showElement(edge?.id);
      }
    });
  }

}