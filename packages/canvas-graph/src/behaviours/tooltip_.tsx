import G6, { BaseBehavior } from '@antv/g6';
import { Card } from '@invana/ui';
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import type { BaseBehaviorOptions, RuntimeContext } from '@antv/g6';


export interface TooltipOptions extends BaseBehaviorOptions {
  className?: string;
}


export class TooltipBehavior extends BaseBehavior {
  private tooltipContainer: HTMLElement | null = null;

  constructor(context: RuntimeContext, options: TooltipOptions) {
    console.log("==TooltipBehavior", TooltipBehavior)
    super(context, options);
    // Create a container for the tooltip
    this.tooltipContainer = document.createElement('div');
    this.tooltipContainer.id = 'TooltipBehavior';
    this.tooltipContainer.style.position = 'absolute';
    this.tooltipContainer.style.pointerEvents = 'none';
    document.body.appendChild(this.tooltipContainer);
  }

  getEvents() {
    return {
      'node:mouseenter': 'onNodeMouseEnter',
      'node:mouseleave': 'onNodeMouseLeave',
      'mousemove': 'onMouseMove',
    };
  }

  private onNodeMouseEnter(evt: { item: any; canvasX: number; canvasY: number }) {
    console.log("===onNodeMouseEnter", evt)
    const { item } = evt;
    if (item) {
      const model = item.getModel();
      this.updateTooltip(true, evt.canvasX, evt.canvasY, model);
    }
  }

  private onNodeMouseLeave() {
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

export default TooltipBehavior;
