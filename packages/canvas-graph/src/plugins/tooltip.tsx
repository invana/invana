import { BaseBehavior, NodeEvent } from '@antv/g6';
import type { BaseBehaviorOptions, RuntimeContext, IPointerEvent, NodeData } from '@antv/g6';
import { Card, CardDescription, CardHeader, CardTitle } from '@invana/ui';
import { ICanvasNode } from '@invana/data-store';
import { createRoot } from 'react-dom/client';
import React from 'react';

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


    const onMouseMove = (e: MouseEvent) => {
      tooltip.style.left = `${e.clientX + 10}px`;
      tooltip.style.top = `${e.clientY + 10}px`;
      tooltip.style.display = 'block';
    };

    const onContextMenu = (e: MouseEvent) => {
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
      const { client, } = event;
      const nodeId = ((event.target as unknown) as HTMLElement).id as string;
      const node = graph.getNodeData(nodeId) as (NodeData & { data?: ICanvasNode });
      console.log("NodeEvent.POINTER_OVER node", node)
      tooltip.style.top = client.y + 'px';
      tooltip.style.left = client.x + 'px';
      tooltip.style.display = 'display';

      root.render(
        <Card className=" shadow-lg">
          <CardHeader className=''>
            <CardTitle className='break-words'>{node?.label as string}</CardTitle>
            <CardDescription className='text-xs'>
              <div><strong>ID:</strong> {node?.id}</div>
              <div><strong>Label:</strong> {node?.data?.type || 'N/A'}</div>
            </CardDescription>
          </CardHeader>
        </Card>
      )

      graph.on(NodeEvent.POINTER_MOVE, onMouseMove);

      graph.on(NodeEvent.POINTER_OUT, () => {
        graph.off(NodeEvent.POINTER_MOVE, onMouseMove);
        hideTooltip();
      });

      graph.on(NodeEvent.CONTEXT_MENU, onContextMenu);

    });
  }
}