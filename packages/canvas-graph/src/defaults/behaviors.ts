import type { IPointerEvent } from '@antv/g6';
import { CanvasGraphBehavior } from '../types';


export const DRAG_CANVAS_BEHAVIOR: CanvasGraphBehavior = {
  type: 'drag-canvas',
  key: 'drag-canvas',
}

export const DRAG_ELEMENT_BEHAVIOR: CanvasGraphBehavior = {
  type: 'drag-element',
  key: 'drag-element',
}

export const ZOOM_CANVAS_BEHAVIOR: CanvasGraphBehavior = {
  type: 'zoom-canvas',
  key: 'zoom-canvas',
  options: {
    minZoom: 0.5,
    maxZoom: 2,
  }
}

export const HOVER_ACTIVATE_BEHAVIOR: CanvasGraphBehavior = {
  type: 'hover-activate',
  key: 'hover-activate',
  animated: false,
  degree: 1,
  state: 'highlight',
  inactiveState: 'dim',
  // onHover: (event: IPointerEvent) => {
  //   event.view.setCursor('pointer');
  // },
  // onHoverEnd: (event: IPointerEvent) => {
  //   event.view.setCursor('default');
  // },
}

export const CLICK_SELECT_BEHAVIOR: CanvasGraphBehavior = {
  type: 'click-select',
  key: 'click-select',
  multiple: true,
  trigger: ['shift'],

}

export const LASSO_SELECT_BEHAVIOR: CanvasGraphBehavior = {
  type: 'lasso-select',
  key: 'lasso-select',
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
  type: 'node-tooltip',
  key: 'node-tooltip',
}

export const EDGE_TOOLTIP_BEHAVIOR: CanvasGraphBehavior = {
  type: 'edge-tooltip',
  key: 'edge-tooltip',
}

export const NODE_CONTEXT_MENU_BEHAVIOR: CanvasGraphBehavior = {
  type: 'node-context-menu',
  key: 'node-context-menu',
}

export const EDGE_CONTEXT_MENU_BEHAVIOR: CanvasGraphBehavior = {
  type: 'edge-context-menu',
  key: 'edge-context-menu',
}

export const CANVAS_CONTEXT_MENU_BEHAVIOR: CanvasGraphBehavior = {
  type: 'canvas-context-menu',
  key: 'canvas-context-menu',
}

export const PROPERTY_VIEWER_BEHAVIOR: CanvasGraphBehavior = {
  type: 'property-viewer',
  key: 'property-viewer',
}

// export const OPTIMIZED_DRAG_CANVAS_BEHAVIOR: CanvasGraphBehavior = {
//   type: 'optimize-viewport-transform',
//   key: 'optimize-viewport-transform'
// }