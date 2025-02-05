import type { IPointerEvent } from '@antv/g6';
import { CanvasGraphBehavior } from '../manager/types';

export const DRAG_CANVAS_BEHAVIOR: CanvasGraphBehavior = {
  type: 'drag-canvas'
}

export const DRAG_ELEMENT_BEHAVIOR: CanvasGraphBehavior = {
  type: 'drag-element'
}

export const ZOOM_CANVAS_BEHAVIOR: CanvasGraphBehavior = {
  type: 'zoom-canvas',
  options: {
    minZoom: 0.5,
    maxZoom: 2,
  }
}

export const HOVER_ACTIVATE_BEHAVIOR: CanvasGraphBehavior = {
  type: 'hover-activate',
  degree: 1,
  state: 'highlight',
  inactiveState: 'dim',
  onHover: (event: IPointerEvent) => {
    console.log("====onHover", event)
    event.view.setCursor('pointer');
  },
  onHoverEnd: (event: IPointerEvent) => {
    event.view.setCursor('default');
  },
}

export const CLICK_SELECT_BEHAVIOR: CanvasGraphBehavior = {
  type: 'click-select',
  multiple: true,
  trigger: 'ctrl',
}

export const LASSO_SELECT_BEHAVIOR: CanvasGraphBehavior = {
  key: 'lasso-select',
  type: 'lasso-select',
  mode: 'diff',
  trigger: 'Drag',
  style: {
    fill: '#00f',
    fillOpacity: 0.1,
    stroke: '#0ff',
    lineWidth: 2,
  },
}

export const NODE_TOOLTIP_BEHAVIOR: CanvasGraphBehavior = {
  type: 'tooltip-node',
}

export const EDGE_TOOLTIP_BEHAVIOR: CanvasGraphBehavior = {
  type: 'tooltip-edge',
}

export const NODE_CONTEXT_MENU_BEHAVIOR: CanvasGraphBehavior = {
  type: 'node-context-menu',
}

export const EDGE_CONTEXT_MENU_BEHAVIOR: CanvasGraphBehavior = {
  type: 'edge-context-menu',
}

export const CANVAS_CONTEXT_MENU_BEHAVIOR: CanvasGraphBehavior = {
  type: 'canvas-context-menu',
}

export const PROPERTY_VIEWER_BEHAVIOR: CanvasGraphBehavior = {
  type: 'property-viewer',
}
