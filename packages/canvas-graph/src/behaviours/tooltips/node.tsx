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
    graph.on(NodeEvent.POINTER_OVER, this.onNodeMouseOver);
  }

  unbindEvents() {
    const { graph } = this.context;
    graph.off(NodeEvent.POINTER_OVER, this.onNodeMouseOver);
    // graph.off(NodeEvent.POINTER_MOVE, this.onNodeMouseMove);
    graph.off(NodeEvent.CONTEXT_MENU, this.onContextMenu);
  }

  createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'NodeTooltipBehavior';
    this.container.style.position = 'absolute';
    // this.container.style.pointerEvents = 'none';
    document.body.appendChild(this.container);
  }

  showContainer = (event: IPointerEvent, padding: { x: number, y: number } = { x: 0, y: 0 }) => {
    const { client } = event;
    this.container.style.left = `${client.x + padding.x}px`;
    this.container.style.top = `${client.y + padding.y}px`;
    this.container.style.display = 'block';
  }

  onNodeMouseMove = (event: IPointerEvent) => {
    this.showContainer(event, { x: 10, y: 10 });
  };

  onContextMenu = (event: IPointerEvent) => {
    console.log("onContextMenu", event)
    const { graph } = this.context;
    graph.off(NodeEvent.POINTER_MOVE, this.onNodeMouseMove);
    graph.off(NodeEvent.CONTEXT_MENU, this.onContextMenu);
    this.hideContainer();
  }

  onMoueLeave = (event: IPointerEvent) => {
    const { graph } = this.context;
    graph.off(NodeEvent.POINTER_MOVE, this.onNodeMouseMove);
    this.hideContainer();
  }

  hideOtherMenus = () => {
    const canvas = document.querySelector('#CanvasContextMenuBehavior') as HTMLElement;
    if (canvas) {
      canvas.style.display = 'none';
    }

    const div = document.querySelector('#EdgeContextMenuBehavior') as HTMLElement;
    if (div) {
      div.style.display = 'none';
    }
  }

  onNodeMouseOver = (event: IPointerEvent) => {
    const { graph } = this.context;
    console.log("onNodeMouseOver", event)
    const nodeId = ((event.target as unknown) as HTMLElement).id as string;
    const node = graph.getNodeData(nodeId) as (NodeData & { data?: ICanvasNode });
    console.log("NodeEvent.POINTER_OVER node", node)
    this.onNodeMouseMove(event)

    this.root.render(
      <NodeCard
        node={node}
        showProperties={false}
        extra={
          <p className='text-xs pl-4 pr-4 pb-4'>(right-click on node for more options)</p>
        } />
    )

    graph.on(NodeEvent.POINTER_MOVE, this.onNodeMouseMove);

    graph.on(NodeEvent.POINTER_OUT, this.onMoueLeave);

    graph.on(NodeEvent.CONTEXT_MENU, this.onContextMenu);

    this.hideOtherMenus();
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