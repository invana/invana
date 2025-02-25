import { BaseBehavior, CanvasEvent, EdgeEvent, NodeEvent } from '@antv/g6';
import type { BaseBehaviorOptions, RuntimeContext, IPointerEvent } from '@antv/g6';
import { ICanvasEdge, ICanvasNode, IProperties } from '@invana/data-store';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { EdgeCard, NodeCard } from '@invana/ui';
import { CanvasGraphEdge, CanvasGraphNode } from '@invana/canvas-graph/types';


export interface PropertyViewerBehaviorOptions extends BaseBehaviorOptions {
  className?: string;
}

export class PropertyViewerBehavior extends BaseBehavior<PropertyViewerBehaviorOptions> {
  container!: HTMLDivElement;
  root!: Root

  constructor(context: RuntimeContext, options: PropertyViewerBehaviorOptions) {
    super(context, options);
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
    graph.off(NodeEvent.POINTER_OVER, this.hideContainer);

    graph.off(EdgeEvent.CLICK, this.onNodeClicked);
    graph.off(EdgeEvent.POINTER_OVER, this.hideContainer);

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

  showContainer = () => {
    this.container.style.display = 'block';
  }

  showNodeData = (event: IPointerEvent) => {
    const { graph } = this.context;
    const nodeId = ((event.target as unknown) as HTMLElement).id as string;
    const node = graph.getNodeData(nodeId) as (CanvasGraphNode);
    const nodeData: ICanvasNode = {
      id: node.id as string,
      label: node.label as string,
      type: node.data?.type ?? '',
      properties: node.data?.properties as IProperties
    }
    const component: React.ReactNode = <NodeCard
      className='h-full w-full'
      node={nodeData}
      showProperties={true}
    />
    this.root.render(component)
  }

  showEdgeData = (event: IPointerEvent) => {
    const { graph } = this.context;
    const edgeId = ((event.target as unknown) as HTMLElement).id as string;
    const edge = graph.getEdgeData(edgeId) as (CanvasGraphEdge);
    const edgeData: ICanvasEdge = {
      id: edge.id as string,
      label: edge.label as string,
      type: edge.data?.type ?? '',
      source: edge.source,
      target: edge.target,
      properties: edge.data?.properties as IProperties
    }

    const component: React.ReactNode = <EdgeCard
      className='h-full !w-full'
      edge={edgeData}
      showProperties={true}
    />
    this.root.render(component)
  }

  onNodeHovered = (event: IPointerEvent) => {
    this.showNodeData(event)
  }


  onEdgeHovered = (event: IPointerEvent) => {
    this.showEdgeData(event);
  }

  onEdgeClicked = (event: IPointerEvent) => {
    console.log("EdgeEvent.CLICKED event", event)
    this.showContainer()
    this.showEdgeData(event)
  }

  onNodeClicked = (event: IPointerEvent) => {
    console.log("NodeEvent.CLICKED event", event)
    this.showContainer()
    this.showNodeData(event)
  }


  hideContainer = () => {
    this.container.style.display = 'none';
  }

  destroy() {
    this.root.unmount();
    document.body.removeChild(this.container);
    this.unbindEvents();
  }

}