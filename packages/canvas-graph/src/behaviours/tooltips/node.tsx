import { BaseBehavior, NodeEvent } from '@antv/g6';
import type { BaseBehaviorOptions, RuntimeContext, IPointerEvent, NodeData } from '@antv/g6';
import { ICanvasNode } from '@invana/data-store';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { NodeCard } from '../../components/node-card';

export interface NodeTooltipBehaviorOptions extends BaseBehaviorOptions {
  className?: string;
}

export class NodeTooltipBehavior extends BaseBehavior<NodeTooltipBehaviorOptions> {

  container!: HTMLDivElement;
  root!: Root

  constructor(context: RuntimeContext, options: NodeTooltipBehaviorOptions) {
    super(context, options);

    this.createContainer();
    this.root = createRoot(this.container);
    this.bindEvents();
  }


  bindEvents() {
    const { graph } = this.context;
    graph.on(NodeEvent.POINTER_OVER, this.onMouseOver);
  }

  unbindEvents() {
    const { graph } = this.context;
    graph.off(NodeEvent.POINTER_OVER, this.onMouseOver);
    graph.off(NodeEvent.POINTER_MOVE, this.onMouseMove);
    graph.off(NodeEvent.CONTEXT_MENU, this.onContextMenu);
  }

  createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'NodeTooltipBehavior';
    this.container.style.position = 'absolute';
    this.container.style.pointerEvents = 'none';
    document.body.appendChild(this.container);
  }



  onMouseMove = (e: IPointerEvent) => {
    const { client } = e;
    this.container.style.left = `${client.x + 10}px`;
    this.container.style.top = `${client.y + 10}px`;
    this.container.style.display = 'block';
  };

  onContextMenu = (event: IPointerEvent) => {
    console.log("onContextMenu", event)
    const { graph } = this.context;
    graph.off(NodeEvent.POINTER_MOVE, this.onMouseMove);
    graph.off(NodeEvent.CONTEXT_MENU, this.onContextMenu);
    this.hideTooltip();
  }

  onMoueLeave = (event: IPointerEvent) => {
    const { graph } = this.context;
    graph.off(NodeEvent.POINTER_MOVE, this.onMouseMove);
    this.hideTooltip();
  }

  onMouseOver = (event: IPointerEvent) => {
    const { graph } = this.context;
    console.log("onMouseOver", event)
    const nodeId = ((event.target as unknown) as HTMLElement).id as string;
    const node = graph.getNodeData(nodeId) as (NodeData & { data?: ICanvasNode });
    console.log("NodeEvent.POINTER_OVER node", node)
    this.onMouseMove(event)

    this.root.render(<NodeCard node={node} />)

    graph.on(NodeEvent.POINTER_MOVE, this.onMouseMove);

    graph.on(NodeEvent.POINTER_OUT, this.onMoueLeave);

    graph.on(NodeEvent.CONTEXT_MENU, this.onContextMenu);

  }

  hideTooltip = () => {
    this.container.style.display = 'none';
  }


  destroy(): void {
    this.root.unmount();
    this.unbindEvents();
  }
}