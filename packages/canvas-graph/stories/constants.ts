import {
  CANVAS_CONTEXT_MENU_BEHAVIOR, CLICK_SELECT_BEHAVIOR, DRAG_CANVAS_BEHAVIOR,
  DRAG_ELEMENT_BEHAVIOR, EDGE_CONTEXT_MENU_BEHAVIOR, EDGE_TOOLTIP_BEHAVIOR,
  HOVER_ACTIVATE_BEHAVIOR, LASSO_SELECT_BEHAVIOR, NODE_CONTEXT_MENU_BEHAVIOR,
  NODE_TOOLTIP_BEHAVIOR, PROPERTY_VIEWER_BEHAVIOR, ZOOM_CANVAS_BEHAVIOR
} from '@invana/canvas-graph/defaults/behaviors';
import { MAP_NODE_SIZE_TRANSFORMER, PROCESS_PARALLEL_TRANSFORMER } from '@invana/canvas-graph/defaults/transforms';
import { MINIMAP_PLUGIN, HISTORY_PLUGIN } from '@invana/canvas-graph/defaults/plugins';
// import { CanvasManagerOptions } from '@invana/canvas-graph/manager/types';
import { D3_FORCE_LAYOUT } from '@invana/canvas-graph/defaults/layouts';
import { ExtensionCategory, register } from '@antv/g6';
import { EdgeTooltipBehavior, NodeTooltipBehavior, PropertyViewerBehavior } from '@invana/canvas-graph/plugins/behaviours';
import { NodeContextMenuBehavior } from '@invana/canvas-graph/plugins/behaviours/context-menus/node';
import { EdgeContextMenuBehavior } from '@invana/canvas-graph/plugins/behaviours/context-menus/edge';
import { CanvasContextMenuBehavior } from '@invana/canvas-graph/plugins/behaviours/context-menus/canvas';
import { CanvasGraphOptions } from '@invana/canvas-graph/types';


register(ExtensionCategory.BEHAVIOR, NODE_TOOLTIP_BEHAVIOR.type, NodeTooltipBehavior, true);
register(ExtensionCategory.BEHAVIOR, EDGE_TOOLTIP_BEHAVIOR.type, EdgeTooltipBehavior, true);
register(ExtensionCategory.BEHAVIOR, NODE_CONTEXT_MENU_BEHAVIOR.type, NodeContextMenuBehavior, true);
register(ExtensionCategory.BEHAVIOR, EDGE_CONTEXT_MENU_BEHAVIOR.type, EdgeContextMenuBehavior, true);
register(ExtensionCategory.BEHAVIOR, CANVAS_CONTEXT_MENU_BEHAVIOR.type, CanvasContextMenuBehavior, true);
register(ExtensionCategory.BEHAVIOR, PROPERTY_VIEWER_BEHAVIOR.type, PropertyViewerBehavior, true);


export const defaultOptions: CanvasGraphOptions = {
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
    MAP_NODE_SIZE_TRANSFORMER,
    // PROCESS_PARALLEL_TRANSFORMER
  ],
  plugins: [
    MINIMAP_PLUGIN,
    HISTORY_PLUGIN,
    // GRID_PLUGIN
  ],
  layout: D3_FORCE_LAYOUT,
  styles: {
    canvas: {
      theme: 'dark',
    }
  }
}

export const defaultContainerStyle = { "width": "100%", "height": "100vh", 'background': '#222' }