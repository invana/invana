import { BaseBehavior, CanvasEvent, EdgeEvent } from '@antv/g6';
import type { BaseBehaviorOptions, RuntimeContext, IPointerEvent, EdgeData } from '@antv/g6';
import { ICanvasEdge, IProperties } from '@invana/data-store';
import { createRoot, Root } from 'react-dom/client';
// import React from 'react';
import { EdgeCard } from '@invana/ui';


export interface EdgePropertyViewerBehaviorOptions extends BaseBehaviorOptions {
  className?: string;
}

export class EdgePropertyViewerBehavior extends BaseBehavior<EdgePropertyViewerBehaviorOptions> {
  container!: HTMLDivElement;
  root!: Root

  constructor(context: RuntimeContext, options: EdgePropertyViewerBehaviorOptions) {
    super(context, options);

    this.createContainer();
    this.root = createRoot(this.container);
    this.bindEvents();
  }

  bindEvents() {
    const { graph } = this.context;
    graph.on(EdgeEvent.CLICK, this.onNodeClicked);
    graph.on(CanvasEvent.CLICK, this.hideContainer);
  }

  unbindEvents() {
    const { graph } = this.context;
    graph.off(EdgeEvent.CLICK, this.onNodeClicked);
    graph.off(CanvasEvent.CLICK, this.hideContainer);
  }

  createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'EdgePropertyViewerBehavior';
    this.container.style.position = 'absolute';
    this.container.style.top = '0px';
    this.container.style.right = '0px';
    // this.container.style.pointerEvents = 'none';
    document.body.appendChild(this.container);
  }

  showContainer = () => {
    this.container.style.display = 'block';
  }

  // onNodeMouseMove = (event: IPointerEvent) => {
  //   this.showContainer(event, { x: 10, y: 10 });
  // };

  // onContextMenu = (event: IPointerEvent) => {
  //   console.log("onContextMenu", event)
  //   const { graph } = this.context;
  //   graph.off(EdgeEvent.CLICK, this.onNodeClicked);
  //   // graph.off(EdgeEvent.CONTEXT_MENU, this.onContextMenu);
  //   this.hideContainer();
  // }

  // onMoueLeave = (_: IPointerEvent) => {
  //   const { graph } = this.context;
  //   graph.off(EdgeEvent.POINTER_MOVE, this.onNodeMouseMove);
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
    console.log("EdgeEvent.CLICKED event", event)
    const { graph } = this.context;
    this.showContainer()
    const edgeId = ((event.target as unknown) as HTMLElement).id as string;
    const edge = graph.getEdgeData(edgeId) as (EdgeData & { data?: ICanvasEdge });
    console.log("EdgeEvent.CLICKED edge", edge)
    const edgeData: ICanvasEdge = {
      id: edge.id as string,
      label: edge.label as string,
      type: edge.data?.type ?? '',
      source: edge.source,
      target: edge.target,
      properties: edge.data?.properties as IProperties
    }
    this.hideOtherPropertyViewers();
    this.root.render(
      <EdgeCard
        className='h-screen'
        edge={edgeData}
        showProperties={true}
      />
    )
  }

  hideOtherPropertyViewers = () => {
    const div = document.querySelector('#NodePropertyViewerBehavior') as HTMLElement;
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