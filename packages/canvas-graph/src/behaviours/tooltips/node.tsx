import { BaseBehavior, NodeEvent } from '@antv/g6';
import type { BaseBehaviorOptions, RuntimeContext, IPointerEvent, NodeData } from '@antv/g6';
import { ICanvasNode } from '@invana/data-store';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { NodeCard } from '../../components/node-card';

export interface NodeTooltipBehaviorOptions extends BaseBehaviorOptions {
  className?: string;
}

export class NodeTooltipBehavior extends BaseBehavior<NodeTooltipBehaviorOptions> {

  container!: HTMLDivElement;

  onMouseMove = (e: IPointerEvent) => {
    const { client } = e;
    this.container.style.left = `${client.x + 10}px`;
    this.container.style.top = `${client.y + 10}px`;
    this.container.style.display = 'block';
  };

  onContextMenu = (e: IPointerEvent) => {
    console.log("onContextMenu", e)
    const { graph } = this.context;
    graph.off(NodeEvent.POINTER_MOVE, this.onMouseMove);
    graph.off(NodeEvent.CONTEXT_MENU, this.onContextMenu);
    this.hideTooltip();
  }

  hideTooltip = () => {
    this.container.style.display = 'none';
  }

  constructor(context: RuntimeContext, options: NodeTooltipBehaviorOptions) {
    super(context, options);

    this.container = document.createElement('div');
    this.container.id = 'NodeTooltipBehavior';
    this.container.style.position = 'absolute';
    const root = createRoot(this.container);
    document.body.appendChild(this.container);

    const { graph } = this.context;
    graph.on(NodeEvent.POINTER_OVER, (event: IPointerEvent) => {
      const nodeId = ((event.target as unknown) as HTMLElement).id as string;
      const node = graph.getNodeData(nodeId) as (NodeData & { data?: ICanvasNode });
      console.log("NodeEvent.POINTER_OVER node", node)
      this.onMouseMove(event)

      root.render(<NodeCard node={node} />)

      graph.on(NodeEvent.POINTER_MOVE, this.onMouseMove);

      graph.on(NodeEvent.POINTER_OUT, () => {
        graph.off(NodeEvent.POINTER_MOVE, this.onMouseMove);
        this.hideTooltip();
      });

      graph.on(NodeEvent.CONTEXT_MENU, this.onContextMenu);

    });
  }
}