import { BaseBehavior, EdgeEvent } from '@antv/g6';
import { Card } from '@invana/ui';
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import type { BaseBehaviorOptions, IPointerEvent, RuntimeContext } from '@antv/g6';


export interface EdgeTooltipOptions extends BaseBehaviorOptions {
  className?: string;
}


export class EdgeTooltipBehavior extends BaseBehavior {
  private tooltipContainer: HTMLElement | null = null;

  constructor(context: RuntimeContext, options: EdgeTooltipOptions) {
    console.log("==EdgeTooltipBehavior", EdgeTooltipBehavior)
    super(context, options);
    // Create a container for the tooltip
    this.tooltipContainer = document.createElement('div');
    this.tooltipContainer.id = 'EdgeTooltipBehavior';
    this.tooltipContainer.style.position = 'absolute';
    this.tooltipContainer.style.pointerEvents = 'none';
    document.body.appendChild(this.tooltipContainer);
    this.events = [
      [EdgeEvent.POINTER_OVER, this.onEdgeMouseEnter.bind(this)],
      [EdgeEvent.POINTER_OUT, this.onEdgeMouseLeave.bind(this)],
      [EdgeEvent.POINTER_MOVE, this.onMouseMove.bind(this)],
    ];
  }

  // events = [
  //   // const events: { [key: string]: (evt: IPointerEvent) => void } = {}
  //   // events[EdgeEvent.POINTER_OVER] = this.onEdgeMouseEnter
  //   // events[EdgeEvent.POINTER_OUT] = this.onEdgeMouseLeave
  //   // events[EdgeEvent.POINTER_MOVE] = this.onMouseMove

  //   // return events
  //   // return [
  //   // mouseOver: this.onEdgeMouseEnter,
  //   ['edge:pointerover', this.onEdgeMouseEnter],
  //   //   'node:mouseleave': 'onEdgeMouseLeave',
  //   //   'mousemove': 'onMouseMove',
  //   // ];
  // ]

  private onEdgeMouseEnter(evt: IPointerEvent) {
    console.log("===onEdgeMouseEnter", evt)
    // if (item) {
    //   const model = item.getModel();
    //   this.updateTooltip(true, evt.canvasX, evt.canvasY, model);
    // }
  }

  private onEdgeMouseLeave() {
    this.updateTooltip(false);
  }

  private onMouseMove(evt: { canvasX: number; canvasY: number }) {
    if (this.tooltipContainer?.style.display === 'block') {
      this.updateTooltip(true, evt.canvasX, evt.canvasY);
    }
  }

  private updateTooltip(visible: boolean, x?: number, y?: number, model?: any) {
    if (this.tooltipContainer) {
      this.tooltipContainer.style.display = visible ? 'block' : 'none';
      if (visible && x !== undefined && y !== undefined) {
        this.tooltipContainer.style.left = `${x + 10}px`;
        this.tooltipContainer.style.top = `${y + 10}px`;

        ReactDOM.render(
          visible && model ? (
            <Card className="p-4 shadow-lg">
              <h4 className="text-lg font-semibold">{model.label || 'Node'}</h4>
              <p>{model.info || 'No additional information available.'}</p>
            </Card>
          ) : <></>,
          this.tooltipContainer
        );
      }
    }
  }

  destroy() {
    if (this.tooltipContainer) {
      ReactDOM.unmountComponentAtNode(this.tooltipContainer);
      document.body.removeChild(this.tooltipContainer);
      this.tooltipContainer = null;
    }
  }
}

