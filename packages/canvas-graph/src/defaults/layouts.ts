import { CanvasGraphLayout } from "../../src_backup/manager/types"
import { CanvasGraphNode } from "../../src_backup/types"

// for more options on layout see:  https://observablehq.com/d/2db6b0cc5e97d8d6#cell-38 or https://g6.antv.vision/en/manual/core-concept/layout
export const GRAPHIN_FORCE_LAYOUT: CanvasGraphLayout = {
  type: 'graphin-force',
  label: 'graphin-force',
}

export const GRID_LAYOUT: CanvasGraphLayout = {
  type: 'grid',
  label: 'grid',
  // align: 'CENTER',   // Alignment of the nodes
  // begin: [0, 0], // Optional
  preventOverlap: true, // Optional, must be used with nodeSize
  preventOverlapPadding: 30, // Optional
  // nodeSize: 30, // Optional
  // condense: false, // Optional
  // rows: 5, // Optional
  // cols: 5, // Optional
  sortBy: 'degree', // Optional
  workerEnabled: true, // Optional, enable web-worker
}

export const CIRCULAR_LAYOUT: CanvasGraphLayout = {
  type: 'circular',
  label: 'circular',
  preventOverlap: true,
  angleRatio: 1, // Optional
  nodeSize: (d: CanvasGraphNode) => ((d.size as number) || 30) + 10,
  nodeSpacing: 10,
  // options: {
  // center: [0, 0], // Optional, default is the center of the graph
  // radius: null, // Optional
  // startRadius: 10, // Optional
  // endRadius: 100, // Optional
  // clockwise: false, // Optional
  // divisions: 5, // Optional
  // ordering: 'degree', // Optional
  // angleRatio: 1, // Optional
  // }
}

export const RADIAL_LAYOUT: CanvasGraphLayout = {
  type: 'radial',
  label: 'radial',
  preventOverlap: true,
  strictRadial: true
  // options: {
  // center: [0, 0], // Optional, default is the center of the graph
  // linkDistance: 150, // Optional, edge length
  // maxIteration: 1000, // Optional
  // focusNode: 'node11', // Optional
  // unitRadius: 100, // Optional
  // preventOverlap: true, // Optional, must be used with nodeSize
  // nodeSize: 30, // Optional
  // strictRadial: false, // Optional
  // workerEnabled: false, // Optional, enable web-worker
  // }
}

export const FORCE_LAYOUT: CanvasGraphLayout = {
  type: 'force',
  label: 'force',

  animation: false,
  preventOverlap: true,
  // center: [200, 200], // Optional, default is the center of the graph
  // linkDistance: 100, // Optional, edge length
  nodeStrength: 30, // Optional
  edgeStrength: 0.8, // Optional
  collideStrength: 0.8, // Optional
  nodeSize: 30, // Optional
  alpha: 0.9, // Optional
  alphaDecay: 0.3, // Optional
  alphaMin: 0.01, // Optional
  // forceSimulation: null, // Optional
  onTick: () => {
    // Optional
    console.log('ticking');
  },
  onLayoutEnd: () => {
    // Optional
    console.log('force layout done');
  }
}

export const GFORCE_LAYOUT: CanvasGraphLayout = {
  type: 'gForce',
  label: 'gForce',
  linkDistance: 150, // Optional, edge length
  nodeStrength: 30, // Optional
  edgeStrength: 0.1, // Optional
  nodeSize: 30, // Optional
  onTick: () => {
    // Optional
    console.log('ticking');
  },
  onLayoutEnd: () => {
    // Optional
    console.log('force layout done');
  },
  workerEnabled: false, // Optional, enable web-worker
  gpuEnabled: false, // Optional, enable GPU parallel computing, supported in G6 4.0
}

export const DAGRE_LAYOUT: CanvasGraphLayout = {
  type: 'dagre',
  label: 'dagre',
  rankdir: 'TB', // Optional, direction for rank nodes. Available values: 'TB' 'BT' 'LR' 'RL'
  align: 'UL', // Optional, align nodes. Available values: 'UL', 'UR', 'DL', 'DR'
  nodesep: 250, // Optional, the separation between adjacent nodes in the same rank
  ranksep: 250, // Optional, the separation between adjacent edges in the same rank
  controlPoints: true, // Optional, add intermediate control points to make edges smooth
}


export const D3_FORCE_LAYOUT: CanvasGraphLayout = {
  type: 'd3-force',
  animation: false,
  collide: {
    //   // Prevent nodes from overlapping by specifying a collision radius for each node.
    radius: (d: CanvasGraphNode) => {
      // console.log("d3-force-layout.radius", d);
      const size = d.style?.size
      if (Array.isArray(size) && size.length > 0) {
        return size[0] * 2.5
      } else {
        return 40
      }
    }
  },
  // link: {
  //   distance: 150,
  //   strength: 2
  // },
  preventOverlap: true,
  // nodeStrength: -100,   // Repulsion force between nodes
  // linkDistance: 100,   // Distance between connected nodes

}

export const CONCENTRIC_LAYOUT: CanvasGraphLayout = {
  type: 'concentric',
  label: 'concentric',
  maxLevelDiff: 0.5,
  sortBy: 'degree',
  // center: [200, 200], // Optional
  // linkDistance: 50, // Optional, edge length
  preventOverlap: true, // Optional, must be used with nodeSize
  // nodeSize: 30, // Optional
  // sweep: 10, // Optional
  // equidistant: false, // Optional
  // startAngle: 0, // Optional
  // clockwise: false, // Optional
  // maxLevelDiff: 10, // Optional
  // sortBy: 'degree', // Optional
  workerEnabled: false, // Optional, enable web-worker
}

export const ANTV_DAGRE_LAYOUT: CanvasGraphLayout = {
  type: 'antv-dagre',
  label: 'antv-dagre',
  nodeSize: [60, 30],
  nodesep: 10,
  ranksep: 70,
  controlPoints: true,
  sortByCombo: true,
  rankdir: 'LR', // Optional, default is the center of the graph
  // align: 'DL', // Optional
  // nodesep: 20, // Optional
  // ranksep: 50, // Optional
  // controlPoints: true, // Optional
}

export const DENDROGRAM_LAYOUT: CanvasGraphLayout = {
  type: 'dendrogram',
  direction: 'LR', // H / V / LR / RL / TB / BT
  nodeSep: 50,
  rankSep: 250,
}

export const FRUCHTERMAN_LAYOUT: CanvasGraphLayout = {
  type: 'fruchterman',
  label: 'fruchterman',
  // center: [200, 200], // Optional, default is the center of the graph
  // gravity: 20, // Optional
  // speed: 2, // Optional
  // clustering: true, // Optional
  // clusterGravity: 30, // Optional
  // maxIteration: 2000, // Optional, number of iterations
  // workerEnabled: false, // Optional, enable web-worker
  // gpuEnabled: false, // Optional, enable GPU parallel computing, supported in G6 4.0
}

export const ALL_AVAILABLE_LAYOUTS: CanvasGraphLayout[] = [
  GRAPHIN_FORCE_LAYOUT,
  GRID_LAYOUT,
  CIRCULAR_LAYOUT,
  RADIAL_LAYOUT,
  FORCE_LAYOUT,
  GFORCE_LAYOUT,
  DAGRE_LAYOUT,
  D3_FORCE_LAYOUT,
  CONCENTRIC_LAYOUT,
  ANTV_DAGRE_LAYOUT,
  FRUCHTERMAN_LAYOUT,
  DENDROGRAM_LAYOUT
]