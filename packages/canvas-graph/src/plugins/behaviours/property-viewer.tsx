import { BaseBehavior, CanvasEvent, EdgeEvent, NodeEvent } from '@antv/g6';
import type { BaseBehaviorOptions, RuntimeContext, IPointerEvent, IEvent } from '@antv/g6';
import { ICanvasEdge, ICanvasNode, IProperties } from '@invana/data-store';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { EdgeCard, NodeCard } from '@invana/ui';
import { CanvasGraphEdge, CanvasGraphNode } from '@invana/canvas-graph/types';


export interface PropertyViewerBehaviorOptions extends BaseBehaviorOptions {
  className?: string;
  onNodeHover?: (event: IPointerEvent, data: ICanvasNode) => void;
  onNodeClick?: (event: IPointerEvent, data: ICanvasNode) => void;

  onEdgeHover?: (event: IPointerEvent, data: ICanvasEdge) => void;
  onEdgeClick?: (event: IPointerEvent, data: ICanvasEdge) => void;

  onClose?: () => void;
}

export class PropertyViewerBehavior extends BaseBehavior<PropertyViewerBehaviorOptions> {
  container!: HTMLDivElement;
  root!: Root

  static defaultOptions: Partial<PropertyViewerBehaviorOptions> = {
    className: '',
    onNodeHover: (_: IPointerEvent, __: ICanvasNode) => { console.log("PropertyViewerBehavior.onNodeHover not set") },
    onNodeClick: (_: IPointerEvent, __: ICanvasNode) => { console.log("PropertyViewerBehavior.onNodeClick not set") },

    onEdgeHover: (_: IPointerEvent, __: ICanvasEdge) => { console.log("PropertyViewerBehavior.onEdgeHover not set") },
    onEdgeClick: (_: IPointerEvent, __: ICanvasEdge) => { console.log("PropertyViewerBehavior.onEdgeClick not set") },

    onClose: () => { console.log("PropertyViewerBehavior.onClose not set") }

  };

  constructor(context: RuntimeContext, options: PropertyViewerBehaviorOptions) {
    super(context, Object.assign({}, PropertyViewerBehavior.defaultOptions, options));
    this.createContainer();
    this.root = createRoot(this.container);
    this.bindEvents();
  }

  bindEvents() {
    const { graph } = this.context;
    graph.on(NodeEvent.CLICK, this.onNodeClicked);
    graph.on(NodeEvent.POINTER_OVER, this.onNodeHovered);

    graph.on(EdgeEvent.CLICK, this.onEdgeClicked);
    graph.on(EdgeEvent.POINTER_OVER, this.onEdgeHovered);

    graph.on(CanvasEvent.CLICK, this.hideContainer);
  }

  unbindEvents() {
    const { graph } = this.context;
    graph.off(NodeEvent.CLICK, this.onNodeClicked);
    graph.off(NodeEvent.POINTER_OVER, this.onNodeHovered);

    graph.off(EdgeEvent.CLICK, this.onEdgeClicked);
    graph.off(EdgeEvent.POINTER_OVER, this.onEdgeHovered);

    graph.off(CanvasEvent.CLICK, this.hideContainer);
  }


  createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'PropertyViewerBehavior';
    this.container.style.position = 'absolute';
    // this.container.style.top = '0px';
    // this.container.style.right = '0px';
    this.container.className = this.options.className ?? 'top-[45px] right-[0px] w-[320px] h-[calc(100vh-45px)]';
    // this.container.classList.add(this.options.className ?? '');
    this.hideContainer();
    // this.container.style.pointerEvents = 'none';
    document.body.appendChild(this.container);
  }



  getNodeData = (event: IPointerEvent): ICanvasNode => {

    const { graph } = this.context;
    const nodeId = ((event.target as unknown) as HTMLElement).id as string;
    const node = graph.getNodeData(nodeId) as (CanvasGraphNode);
    return {
      id: node.id as string,
      label: node.label as string,
      type: node.data?.type ?? '',
      properties: node.data?.properties as IProperties
    }
  }

  showNodeData = (event: IPointerEvent) => {
    const nodeData = this.getNodeData(event);
    const { onNodeHover } = this.options;
    if (onNodeHover) {
      onNodeHover(event, nodeData)
    } else {
      const component: React.ReactNode = <NodeCard
        className='h-full w-full'
        node={nodeData}
        showProperties={true}
      />
      this.root.render(component)
    }

  }

  getEdgeData = (event: IPointerEvent): ICanvasEdge => {
    const { graph } = this.context;
    const edgeId = ((event.target as unknown) as HTMLElement).id as string;
    const edge = graph.getEdgeData(edgeId) as (CanvasGraphEdge);
    return {
      id: edge.id as string,
      label: edge.label as string,
      type: edge.data?.type ?? '',
      source: edge.source,
      target: edge.target,
      properties: edge.data?.properties as IProperties
    }
  }

  showEdgeData = (event: IPointerEvent) => {
    const { onEdgeHover } = this.options;
    const edgeData = this.getEdgeData(event)
    if (onEdgeHover) {
      onEdgeHover(event, edgeData)
    } else {
      const component: React.ReactNode = <EdgeCard
        className='h-full !w-full'
        edge={edgeData}
        showProperties={true}
      />
      this.root.render(component)
    }
  }

  onNodeHovered = (event: IPointerEvent) => {
    this.showNodeData(event)
  }


  onEdgeHovered = (event: IPointerEvent) => {
    this.showEdgeData(event);
  }

  onEdgeClicked = (event: IPointerEvent) => {
    console.log("EdgeEvent.CLICKED event", event)
    this.showEdgeContainer(event)
    // this.showEdgeData(event)
  }

  showEdgeContainer = (event: IPointerEvent) => {
    const edgeData = this.getEdgeData(event);
    if (this.options.onEdgeClick) {
      this.options.onEdgeClick(event, edgeData)
    } else {
      this.container.style.display = 'block';
    }
  }

  onNodeClicked = (event: IPointerEvent) => {
    console.log("NodeEvent.CLICKED event", event)
    this.showNodeContainer(event)
    // this.showNodeData(event)
  }


  showNodeContainer = (event: IPointerEvent) => {
    const nodeData = this.getNodeData(event);
    if (this.options.onNodeClick) {
      this.options.onNodeClick(event, nodeData)
    } else {
      this.container.style.display = 'block';
    }
  }

  hideContainer = (event?: IEvent) => {
    console.log("=====hideContainer", event)
    if (event) {
      this.options?.onClose()
    }
    this.container.style.display = 'none';

  }

  destroy() {
    this.root.unmount();
    document.body.removeChild(this.container);
    this.unbindEvents();
  }

}