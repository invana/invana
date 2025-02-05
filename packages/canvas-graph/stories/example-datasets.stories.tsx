import { CanvasGraph } from '@invana/canvas-graph';
import type { Meta, StoryObj } from '@storybook/react';
import { flightData, lesMiserablesData } from '@invana/example-datasets'
import {
  CANVAS_CONTEXT_MENU_BEHAVIOR, CLICK_SELECT_BEHAVIOR, DRAG_CANVAS_BEHAVIOR,
  DRAG_ELEMENT_BEHAVIOR, EDGE_CONTEXT_MENU_BEHAVIOR, EDGE_TOOLTIP_BEHAVIOR,
  HOVER_ACTIVATE_BEHAVIOR, LASSO_SELECT_BEHAVIOR, NODE_CONTEXT_MENU_BEHAVIOR,
  NODE_TOOLTIP_BEHAVIOR, PROPERTY_VIEWER_BEHAVIOR, ZOOM_CANVAS_BEHAVIOR
} from '@invana/canvas-graph/defaults/behaviors';
import { MAP_NODE_SIZE_TRANSFORMER } from '@invana/canvas-graph/defaults/transforms';
import { MINIMAP_PLUGIN, HISTORY_PLUGIN, GRID_PLUGIN } from '@invana/canvas-graph/defaults/plugins';
import { CanvasManagerOptions } from '@invana/canvas-graph/manager/types';
import { GRID_LAYOUT } from '@invana/canvas-graph/defaults/layouts';
import { ExtensionCategory, register } from '@antv/g6';
import { EdgeTooltipBehavior, NodeTooltipBehavior, PropertyViewerBehavior } from '@invana/canvas-graph/behaviours';
import { NodeContextMenuBehavior } from '@invana/canvas-graph/behaviours/context-menus/node';
import { EdgeContextMenuBehavior } from '@invana/canvas-graph/behaviours/context-menus/edge';
import { CanvasContextMenuBehavior } from '@invana/canvas-graph/behaviours/context-menus/canvas';

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'Datasets',
  component: CanvasGraph,
  parameters: {
    layout: 'fullscreen',
  },
  // tags: ['autodocs'],
} satisfies Meta<typeof CanvasGraph>;

export default meta;
type Story = StoryObj<typeof meta>;


register(ExtensionCategory.BEHAVIOR, 'tooltip-node', NodeTooltipBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'tooltip-edge', EdgeTooltipBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'node-context-menu', NodeContextMenuBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'edge-context-menu', EdgeContextMenuBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'canvas-context-menu', CanvasContextMenuBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'property-viewer', PropertyViewerBehavior, true);


const defaultOptions: CanvasManagerOptions = {
  behaviors: [
    DRAG_CANVAS_BEHAVIOR,
    DRAG_ELEMENT_BEHAVIOR,
    ZOOM_CANVAS_BEHAVIOR,
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
    MAP_NODE_SIZE_TRANSFORMER
  ],
  plugins: [
    MINIMAP_PLUGIN,
    HISTORY_PLUGIN,
    GRID_PLUGIN
  ],
  layout: GRID_LAYOUT
}

export const FlightData: Story = {
  args: {
    options: defaultOptions,
    initData: {
      nodes: flightData.nodes,
      edges: flightData.edges,
    },
    containerStyle: { "width": "100%", "height": "calc(100vh - 40px)" }
  },
};

export const LesMiserables: Story = {
  args: {
    options: defaultOptions,
    initData: {
      nodes: lesMiserablesData.nodes,
      edges: lesMiserablesData.edges,
    },
    containerStyle: { "width": "100%", "height": "calc(100vh - 40px)" }
  },
};