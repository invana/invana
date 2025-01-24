import { BaseBehavior, NodeEvent } from '@antv/g6';
import type { BaseBehaviorOptions, RuntimeContext, IPointerEvent, NodeData } from '@antv/g6';
import { ICanvasNode } from '@invana/data-store';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { NodeCard } from '../components/node-card';

export interface TooltipBehaviorOptions extends BaseBehaviorOptions {
  className?: string;
}



export class TooltipBehavior extends BaseBehavior<TooltipBehaviorOptions> {
  constructor(context: RuntimeContext, options: TooltipBehaviorOptions) {
    super(context, options);
    const tooltip = document.createElement('div');
    tooltip.id = 'TooltipBehavior';
    tooltip.style.position = 'absolute';
    const root = createRoot(tooltip);

    const onMouseMove = (e: IPointerEvent) => {
      const { client } = e;
      tooltip.style.left = `${client.x + 10}px`;
      tooltip.style.top = `${client.y + 10}px`;
      tooltip.style.display = 'block';
    };

    const onContextMenu = (e: IPointerEvent) => {
      console.log("onContextMenu", e)
      graph.off(NodeEvent.POINTER_MOVE, onMouseMove);
      graph.off(NodeEvent.CONTEXT_MENU, onContextMenu);
      hideTooltip();
    }

    const hideTooltip = () => {
      tooltip.style.display = 'none';
    }

    document.body.appendChild(tooltip);

    const { graph } = this.context;
    graph.on(NodeEvent.POINTER_OVER, (event: IPointerEvent) => {
      const nodeId = ((event.target as unknown) as HTMLElement).id as string;
      const node = graph.getNodeData(nodeId) as (NodeData & { data?: ICanvasNode });
      console.log("NodeEvent.POINTER_OVER node", node)
      onMouseMove(event)

      root.render(<NodeCard node={node} />)

      graph.on(NodeEvent.POINTER_MOVE, onMouseMove);

      graph.on(NodeEvent.POINTER_OUT, () => {
        graph.off(NodeEvent.POINTER_MOVE, onMouseMove);
        hideTooltip();
      });

      graph.on(NodeEvent.CONTEXT_MENU, onContextMenu);

    });
  }
}