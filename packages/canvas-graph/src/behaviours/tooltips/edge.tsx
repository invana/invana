import { BaseBehavior, EdgeEvent } from '@antv/g6';
import { Card } from '@invana/ui';
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import type { BaseBehaviorOptions, EdgeData, IPointerEvent, RuntimeContext } from '@antv/g6';
import { createRoot, Root } from 'react-dom/client';
import { ICanvasEdge } from '@invana/data-store';
import { NodeCard } from '@invana/canvas-graph/components/node-card';


export interface EdgeTooltipOptions extends BaseBehaviorOptions {
  className?: string;
}


export class EdgeTooltipBehavior extends BaseBehavior {

  container!: HTMLElement;
  root!: Root

  constructor(context: RuntimeContext, options: EdgeTooltipOptions) {
    console.log("==EdgeTooltipBehavior", EdgeTooltipBehavior)
    super(context, options);
    this.createContainer();
    this.root = createRoot(this.container);
    this.bindEvents();
  }


  public update(options: Partial<EdgeTooltipOptions>): void {
    this.unbindEvents();
    super.update(options);
    this.bindEvents();
    // this.onToggleVisibility({} as IEvent);
  }


  createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'EdgeTooltipBehavior';
    this.container.style.position = 'absolute';
    this.container.style.pointerEvents = 'none';
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

  hideTooltip = () => {
    this.container.style.display = 'none';
  }

  private onEdgeMouseOver(event: IPointerEvent) {
    console.log("===onEdgeMouseOver", event)
    const { graph } = this.context;
    console.log("onMouseOver", event)
    const edgeId = ((event.target as unknown) as HTMLElement).id as string;
    const edge = graph.getEdgeData(edgeId) as (EdgeData & { data?: ICanvasEdge });
    console.log("EdgeEvent.POINTER_OVER node", edge)
    this.onMouseMove(event)

    this.root.render(<NodeCard node={edge} />)

    graph.on(EdgeEvent.POINTER_MOVE, this.onMouseMove.bind(this));

    graph.on(EdgeEvent.POINTER_OUT, () => {
      graph.off(EdgeEvent.POINTER_MOVE, this.onMouseMove.bind(this));
      this.hideTooltip();
    });

    graph.on(EdgeEvent.CONTEXT_MENU, this.onContextMenu.bind(this));

  }

  onContextMenu = (e: IPointerEvent) => {
    console.log("onContextMenu", e)
    const { graph } = this.context;
    graph.off(EdgeEvent.POINTER_MOVE, this.onMouseMove.bind(this));
    graph.off(EdgeEvent.CONTEXT_MENU, this.onContextMenu.bind(this));
    this.hideTooltip();
  }

  private onEdgeMouseLeave(event: IPointerEvent) {
    console.log("===onEdgeMouseLeave", event)
    const { graph } = this.context;
    graph.off(EdgeEvent.POINTER_MOVE, this.onMouseMove.bind(this));
    this.hideTooltip();
  }

  private onMouseMove(event: IPointerEvent) {
    console.log("===onMouseMove", event)
    const { client } = event;
    this.container.style.left = `${client.x + 10}px`;
    this.container.style.top = `${client.y + 10}px`;
    this.container.style.display = 'block';
  }

  private updateTooltip(visible: boolean, x?: number, y?: number, model?: any) {
    if (this.container) {
      this.container.style.display = visible ? 'block' : 'none';
      if (visible && x !== undefined && y !== undefined) {
        this.container.style.left = `${x + 10}px`;
        this.container.style.top = `${y + 10}px`;

        ReactDOM.render(
          visible && model ? (
            <Card className="p-4 shadow-lg">
              <h4 className="text-lg font-semibold">{model.label || 'Node'}</h4>
              <p>{model.info || 'No additional information available.'}</p>
            </Card>
          ) : <></>,
          this.container
        );
      }
    }
  }

  destroy() {
    if (this.container) {
      ReactDOM.unmountComponentAtNode(this.container);
      document.body.removeChild(this.container);
      this.container = null;
    }
  }
}

