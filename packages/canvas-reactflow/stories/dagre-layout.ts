import dagre from '@dagrejs/dagre';
import { DataTreeNodeItem, DataTreeNodeProps } from '@invana/canvas-reactflow/templates/nodes/DataTreeNode';
import { Position } from "@xyflow/react";
import { Edge, ReactFlowInstance } from "@xyflow/react"


export interface DagreLayoutOptions {
  nodeWidth?: number
  nodeHeight?: number
  padding?: number
}

export const defaultDagreLayoutOptions: DagreLayoutOptions = {
  nodeWidth: 320 + 30,
  nodeHeight: 100,
  padding: 30
}

export default class DagreLayoutEngine {

  // should have the method getLayoutedElements(nodes, edges, flowInstance, direction)

  options: DagreLayoutOptions = defaultDagreLayoutOptions
  dagreGraph = new dagre.graphlib.Graph();

  constructor(options: DagreLayoutOptions = defaultDagreLayoutOptions) {
    this.options = { ...this.options, ...options }
  }

  calcNodeHeight = (node: DataTreeNodeProps | null) => {
    console.log("====calcNodeHeight=  node", node?.data.children)
    let height = this.options.nodeHeight || 100;
    if (node?.data?.children?.length) {
      // let totalChildrenHeight = 0;
      const countNestedChildren = (children: DataTreeNodeItem[]): number => {
        let count = children.length;
        children.forEach(child => {
          if (child.children?.length) {
            count += countNestedChildren(child.children);
          }
        });
        return count;
      };
      const totalChildren = countNestedChildren(node.data.children);
      height = (totalChildren * 40);
    }
    return height;
  }

  calcNodeWidth = (node: DataTreeNodeProps | null) => {
    return node?.width || this.options.nodeWidth
  }

  getLayoutedElements = (
    nodes: DataTreeNodeProps[],
    edges: Edge[],
    direction: string = "LR") => {

    // https://v9.reactflow.dev/examples/layouting/
    // In order to keep this example simple the node width and height are hardcoded.
    // In a real world app you would use the correct width and height values of
    // const nodes = useStoreState(state => state.nodes) and then node.__rf.width, node.__rf.height
    this.dagreGraph.setDefaultEdgeLabel(() => ({}));

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const _this = this;
    const isHorizontal = direction === "LR";
    const graphOptions = direction === "LR" ? { rankSep: 150 } : { rankSep: 100 }
    this.dagreGraph.setGraph({
      rankdir: direction,
      // nodesep:200,
      ...graphOptions
    });

    nodes.forEach((node: DataTreeNodeProps) => {
      _this.dagreGraph.setNode(node.id, {
        width: _this.calcNodeWidth(node),
        height: _this.calcNodeHeight(node)
      });
    });

    edges.forEach((edge: { source: string; target: string; }) => {
      _this.dagreGraph.setEdge(edge.source, edge.target, {
        // length: 200 // TODO - customise edge length etc here ? may be 
      });
    });

    dagre.layout(this.dagreGraph);

    nodes.forEach((node: DataTreeNodeProps) => {
      const nodeWithPosition = _this.dagreGraph.node(node.id);
      node.targetPosition = isHorizontal ? Position.Left : Position.Top;
      node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      node.position = {
        x: nodeWithPosition.x - nodeWithPosition.width / 2,
        y: nodeWithPosition.y - nodeWithPosition.height / 2
      };

      return node;
    });
    const layoutedNodes = nodes;
    const layoutedEdges = edges;

    return { layoutedNodes, layoutedEdges };
  };

}




