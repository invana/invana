import { BaseBehavior, EdgeEvent } from '@antv/g6';
import type { BaseBehaviorOptions, EdgeData, IPointerEvent, RuntimeContext } from '@antv/g6';
import { createRoot, Root } from 'react-dom/client';
import { ICanvasEdge, IProperties } from '@invana/data-store';
import { EdgeCard } from '@invana/ui';
// import React from 'react';


export interface EdgeTooltipBehaviorOptions extends BaseBehaviorOptions {
  className?: string;
}

export class EdgeTooltipBehavior extends BaseBehavior {

  container!: HTMLElement;
  root!: Root

  constructor(context: RuntimeContext, options: EdgeTooltipBehaviorOptions) {
    super(context, options);
    this.createContainer();
    this.root = createRoot(this.container);
    this.bindEvents();
  }

  public update(options: Partial<EdgeTooltipBehaviorOptions>): void {
    this.unbindEvents();
    super.update(options);
    this.bindEvents();
    // this.onToggleVisibility({} as IEvent);
  }

  createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'EdgeTooltipBehavior';
    this.container.style.position = 'absolute';
    // this.container.style.pointerEvents = 'none';
    document.body.appendChild(this.container);
  }

  bindEvents() {
    const { graph } = this.context;
    graph.on(EdgeEvent.POINTER_OVER, this.onEdgeMouseOver.bind(this));
    graph.on(EdgeEvent.POINTER_OUT, this.onEdgeMouseLeave.bind(this));
    graph.on(EdgeEvent.POINTER_MOVE, this.onMouseMove.bind(this));
  }

  unbindEvents() {
    const { graph } = this.context;
    graph.off(EdgeEvent.POINTER_OVER, this.onEdgeMouseOver.bind(this));
    graph.off(EdgeEvent.POINTER_OUT, this.onEdgeMouseLeave.bind(this));
    graph.off(EdgeEvent.POINTER_MOVE, this.onMouseMove.bind(this));
  }

  hideContainer = () => {
    this.container.style.display = 'none';
  }

  showContainer = (event: IPointerEvent, padding: { x: number, y: number } = { x: 0, y: 0 }) => {
    const { client } = event;
    this.container.style.left = `${client.x + padding.x}px`;
    this.container.style.top = `${client.y + padding.y}px`;
    this.container.style.display = 'block';
  }

  hideOtherMenus = () => {
    const canvas = document.querySelector('#CanvasContextMenuBehavior') as HTMLElement;
    if (canvas) {
      canvas.style.display = 'none';
    }

    const div = document.querySelector('#NodeContextMenuBehavior') as HTMLElement;
    if (div) {
      div.style.display = 'none';
    }
  }

  onEdgeMouseOver(event: IPointerEvent) {
    console.log("===onEdgeMouseOver", event)
    const { graph } = this.context;
    const edgeId = ((event.target as unknown) as HTMLElement).id as string;
    const edge = graph.getEdgeData(edgeId) as (EdgeData & { data?: ICanvasEdge });
    this.onMouseMove(event)

    const edgeData: ICanvasEdge = {
      id: edge.id as string,
      label: edge.label as string,
      type: edge.data?.type ?? '',
      source: edge.source,
      target: edge.target,
      properties: edge.data?.properties as IProperties
    }
    this.root.render(
      <EdgeCard
        edge={edgeData}
        showProperties={false}
        extra={
          <p className='text-xs pl-4 pr-4 pb-4'>(right-click on edge for more options)</p>
        } />
    )
    graph.on(EdgeEvent.POINTER_MOVE, this.onMouseMove.bind(this));
    graph.on(EdgeEvent.POINTER_OUT, () => {
      graph.off(EdgeEvent.POINTER_MOVE, this.onMouseMove.bind(this));
      this.hideContainer();
    });
    graph.on(EdgeEvent.CONTEXT_MENU, this.onContextMenu.bind(this));
    this.hideOtherMenus();
  }

  onContextMenu = (e: IPointerEvent) => {
    console.log("onContextMenu", e)
    const { graph } = this.context;
    graph.off(EdgeEvent.POINTER_MOVE, this.onMouseMove.bind(this));
    graph.off(EdgeEvent.CONTEXT_MENU, this.onContextMenu.bind(this));
    this.hideContainer();
  }

  onEdgeMouseLeave(event: IPointerEvent) {
    console.log("===onEdgeMouseLeave", event)
    const { graph } = this.context;
    graph.off(EdgeEvent.POINTER_MOVE, this.onMouseMove.bind(this));
    this.hideContainer();
  }

  onMouseMove(event: IPointerEvent) {
    this.showContainer(event, { x: 10, y: 10 });
  }

  destroy() {
    this.root.unmount();
    document.body.removeChild(this.container);
    this.unbindEvents();
  }

}

