import { EdgeOptions, Graph, GraphOptions, NodeOptions } from '@antv/g6'
import { CanvasManagerOptions } from './types';
import {
  convert_canvas_style_to_g6_style,
  convert_edge_canvas_style_to_g6_sytle,
  convert_node_canvas_style_to_g6_style,
  generateElementLabel
} from './style_utils';
import { ICanvasStyle, mergeDeep } from '@invana/data-store';
import { NodeStyle } from '@antv/g6/lib/spec/element/node';
import { EdgeStyle } from '@antv/g6/lib/spec/element/edge';
import { CanvasGraphEdge, CanvasGraphNode } from '../types';


export class GraphStyle {

  private graph: Graph
  private options!: CanvasManagerOptions

  constructor(graph: Graph, options: CanvasManagerOptions) {
    console.log("GraphStyle.constructor", graph, options.styles);
    this.graph = graph;
    this.options = options;
  }

  private getUpdatedDefaultNodeStyle = (options: CanvasManagerOptions): NodeStyle => {
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
      const DEFAULT_NODE_STYLE = this.getUpdatedDefaultNodeStyle(options);
      graphOptions.node = DEFAULT_NODE_STYLE as NodeOptions
    }

    // default edge styling
    if (newOptions.styles?.defaultEdge || newOptions.styles?.canvas?.theme) {
      const defaulEdgeStyle = this.getUpdatedDefaultEdgeStyle(options);
      graphOptions.edge = defaulEdgeStyle as EdgeOptions
    }

    console.log("graphOptions", graphOptions)
    // this.graph.setOptions(graphOptions)
    return graphOptions
  }


  hideNodeLabel(nodeId: string) {
    console.log("===hideNodeLabel", nodeId)
    this.graph.updateNodeData([{ id: nodeId, style: { labelText: undefined } }])
    // this.graph.render()
  }

  showNodeLabel(nodeId: string) {
    const customNodeStyles = this.options.styles?.nodes || {};
    const d = this.graph.getNodeData(nodeId) as CanvasGraphNode;
    if (d) {
      const labelText = generateElementLabel(d, customNodeStyles, d.id)
      //@ts-ignore
      this.graph.updateNodeData([{ id: nodeId, style: { labelText: labelText } }])
      this.graph.render()

    } else {
      console.error("node not found", nodeId)
    }
  }

  hideEdgeLabel(edgeId: string) {
    this.graph.updateEdgeData([{ id: edgeId, style: { labelText: undefined } }])
    this.graph.render()
  }

  showEdgeLabel(edgeId: string) {
    const customEdgeStyles = this.options.styles?.edges || {};
    const d = this.graph.getEdgeData(edgeId) as CanvasGraphEdge;
    if (d) {
      const labelText = generateElementLabel(d, customEdgeStyles, undefined)
      //@ts-ignore
      this.graph.updateEdgeData([{ id: edgeId, style: { labelText: labelText } }]);
      this.graph.render()
    } else {
      console.error("edge not found", edgeId)
    }
  }

  hideAllNodeLabels() {
    console.log("hideAllNodeLabels called")
    this.graph.getNodeData().forEach((node) => this.hideNodeLabel(node.id))
    this.graph.render();
  }

  hideAllEdgeLabels() {
    this.graph.getEdgeData().forEach((edge) => {
      if (edge.id) {
        this.hideEdgeLabel(edge.id)
      }
    })
  }

  hideAllNodes() {
    this.graph.getNodeData().forEach((node) => this.graph.hideElement(node.id))
  }

  showAllNodes() {
    this.graph.getNodeData().forEach((node) => this.graph.showElement(node.id))
  }

  hideEdge(edgeId: string) {
    this.graph.hideElement(edgeId);
  }

  showEdge(edgeId: string) {
    this.graph.showElement(edgeId);
  }


  hideAllEdges() {
    console.log("this.graph.getEdgeData() called")
    this.graph.getEdgeData().forEach((edge) => {
      if (edge?.id) {
        this.hideEdge(edge.id);
      }
    });
  }

  showAllEdges() {
    this.graph.getEdgeData().forEach((edge) => {
      if (edge?.id) {
        this.showEdge(edge?.id);
      }
    });
  }

}