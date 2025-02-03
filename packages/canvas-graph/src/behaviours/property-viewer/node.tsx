import { BaseBehavior, NodeEvent } from '@antv/g6';
import type { BaseBehaviorOptions, RuntimeContext, IPointerEvent, NodeData } from '@antv/g6';
import { ICanvasNode, IProperties } from '@invana/data-store';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { NodeCard } from '@invana/ui';


export interface NodePropertyViewerBehaviorOptions extends BaseBehaviorOptions {
  className?: string;
}

export class NodePropertyViewerBehavior extends BaseBehavior<NodePropertyViewerBehaviorOptions> {
  container!: HTMLDivElement;
  root!: Root

  constructor(context: RuntimeContext, options: NodePropertyViewerBehaviorOptions) {
    super(context, options);
    this.createContainer();
    this.root = createRoot(this.container);
    this.bindEvents();
  }

  bindEvents() {
    const { graph } = this.context;
    graph.on(NodeEvent.CLICK, this.onNodeClicked);
  }

  unbindEvents() {
    const { graph } = this.context;
    graph.off(NodeEvent.CLICK, this.onNodeClicked);
  }

  createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'NodePropertyViewerBehavior';
    this.container.style.position = 'absolute';
    this.container.style.top = '0px';
    this.container.style.right = '0px';
    // this.container.style.pointerEvents = 'none';
    document.body.appendChild(this.container);
  }

  // showContainer = (event: IPointerEvent, padding: { x: number, y: number } = { x: 0, y: 0 }) => {
  //   const { client } = event;
  //   this.container.style.left = `${client.x + padding.x}px`;
  //   this.container.style.top = `${client.y + padding.y}px`;
  //   this.container.style.display = 'block';
  // }

  // onNodeMouseMove = (event: IPointerEvent) => {
  //   this.showContainer(event, { x: 10, y: 10 });
  // };

  // onContextMenu = (event: IPointerEvent) => {
  //   console.log("onContextMenu", event)
  //   const { graph } = this.context;
  //   graph.off(NodeEvent.CLICK, this.onNodeClicked);
  //   // graph.off(NodeEvent.CONTEXT_MENU, this.onContextMenu);
  //   this.hideContainer();
  // }

  // onMoueLeave = (_: IPointerEvent) => {
  //   const { graph } = this.context;
  //   graph.off(NodeEvent.POINTER_MOVE, this.onNodeMouseMove);
  //   this.hideContainer();
  // }

  // hideOtherMenus = () => {
  //   const canvas = document.querySelector('#CanvasContextMenuBehavior') as HTMLElement;
  //   if (canvas) {
  //     canvas.style.display = 'none';
  //   }

  //   const div = document.querySelector('#EdgeContextMenuBehavior') as HTMLElement;
  //   if (div) {
  //     div.style.display = 'none';
  //   }
  // }

  onNodeClicked = (event: IPointerEvent) => {
    const { graph } = this.context;
    console.log("onNodeClicked", event)
    const nodeId = ((event.target as unknown) as HTMLElement).id as string;
    const node = graph.getNodeData(nodeId) as (NodeData & { data?: ICanvasNode });
    console.log("NodeEvent.CLICKED node", node)

    const nodeData: ICanvasNode = {
      id: node.id as string,
      label: node.label as string,
      type: node.data?.type ?? '',
      properties: node.data?.properties as IProperties
    }
    console.log("NodeEvent.CLICKED nodeData", nodeData)

    this.root.render(
      <NodeCard
        className='h-screen'
        node={nodeData}
        showProperties={true}
      />
    )

    this.hideOtherPropertyViewers();
  }

  hideOtherPropertyViewers = () => {
    const div = document.querySelector('#EdgePropertyViewerBehavior') as HTMLElement;
    if (div) {
      div.style.display = 'none';
    }
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