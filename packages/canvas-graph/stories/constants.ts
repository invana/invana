import {
  CANVAS_CONTEXT_MENU_BEHAVIOR, CLICK_SELECT_BEHAVIOR, DRAG_CANVAS_BEHAVIOR,
  DRAG_ELEMENT_BEHAVIOR, EDGE_CONTEXT_MENU_BEHAVIOR, EDGE_TOOLTIP_BEHAVIOR,
  HOVER_ACTIVATE_BEHAVIOR, LASSO_SELECT_BEHAVIOR, NODE_CONTEXT_MENU_BEHAVIOR,
  NODE_TOOLTIP_BEHAVIOR, PROPERTY_VIEWER_BEHAVIOR, ZOOM_CANVAS_BEHAVIOR
} from '@invana/canvas-graph/defaults/behaviors';
import { MAP_NODE_SIZE_TRANSFORMER } from '@invana/canvas-graph/defaults/transforms';
import { MINIMAP_PLUGIN, HISTORY_PLUGIN } from '@invana/canvas-graph/defaults/plugins';
import { CanvasManagerOptions } from '@invana/canvas-graph/manager/types';
import { GRID_LAYOUT } from '@invana/canvas-graph/defaults/layouts';
import { ExtensionCategory, register } from '@antv/g6';
import { EdgeTooltipBehavior, NodeTooltipBehavior, PropertyViewerBehavior } from '@invana/canvas-graph/behaviours';
import { NodeContextMenuBehavior } from '@invana/canvas-graph/behaviours/context-menus/node';
import { EdgeContextMenuBehavior } from '@invana/canvas-graph/behaviours/context-menus/edge';
import { CanvasContextMenuBehavior } from '@invana/canvas-graph/behaviours/context-menus/canvas';


register(ExtensionCategory.BEHAVIOR, 'tooltip-node', NodeTooltipBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'tooltip-edge', EdgeTooltipBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'node-context-menu', NodeContextMenuBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'edge-context-menu', EdgeContextMenuBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'canvas-context-menu', CanvasContextMenuBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'property-viewer', PropertyViewerBehavior, true);


export const defaultOptions: CanvasManagerOptions = {
  behaviors: [
    DRAG_CANVAS_BEHAVIOR,
    ZOOM_CANVAS_BEHAVIOR,
    DRAG_ELEMENT_BEHAVIOR,
    HOVER_ACTIVATE_BEHAVIOR,
    CLICK_SELECT_BEHAVIOR,
    LASSO_SELECT_BEHAVIOR,
    NODE_TOOLTIP_BEHAVIOR,
    EDGE_TOOLTIP_BEHAVIOR,
    NODE_CONTEXT_MENU_BEHAVIOR,
    EDGE_CONTEXT_MENU_BEHAVIOR,
    CANVAS_CONTEXT_MENU_BEHAVIOR,
    PROPERTY_VIEWER_BEHAVIOR
  ],
  transforms: [
    // MAP_NODE_SIZE_TRANSFORMER
  ],
  plugins: [
    MINIMAP_PLUGIN,
    HISTORY_PLUGIN,
    // GRID_PLUGIN
  ],
  layout: GRID_LAYOUT,
  styles: {
    canvas: {
      // theme: 'light',
    }
  }
}