import { CanvasGraphPlugin } from "../../src_backup/manager/types"


export const MINIMAP_PLUGIN: CanvasGraphPlugin = {
  type: 'minimap',
  key: 'minimap',
  size: [240, 160],
  className: 'minimap',
  position: 'bottom-left',
  // position: 'bottomLeft',
  // delegateStyle: {
  //   fill: 'rgba(0, 0, 0, 0.1)',
  //   stroke: '#5B8FF9',
  // },
}

export const HISTORY_PLUGIN: CanvasGraphPlugin = {
  type: 'history',
  key: 'history',
}

export const GRID_PLUGIN: CanvasGraphPlugin = {
  type: 'grid-line',
  key: 'grid-line',
  follow: true,
  lineStyle: {
    stroke: '#222222', // Set grid line color
    lineWidth: 1, // Set line width
  }
}

