import { NodeData } from '@antv/g6';


export const defaultLayoutsOptions = [
  {
    type: 'graphin-force',
    label: 'graphin-force',
  },
  {
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
  },
  // {
  //   type: 'orthogonal',  // Set the layout type to orthogonal
  //   directed: true,      // Optional: Specify if edges are directed
  //   sortByCombo: false   // Optional: Control if edges should follow combo structures
  // },
  {
    type: 'circular',
    label: 'circular',
    options: {
      // center: [0, 0], // Optional, default is the center of the graph
      // radius: null, // Optional
      // startRadius: 10, // Optional
      // endRadius: 100, // Optional
      // clockwise: false, // Optional
      // divisions: 5, // Optional
      // ordering: 'degree', // Optional
      // angleRatio: 1, // Optional
    }
  },
  {
    type: 'radial',
    label: 'radial',
    options: {
      center: [0, 0], // Optional, default is the center of the graph
      linkDistance: 150, // Optional, edge length
      maxIteration: 1000, // Optional
      focusNode: 'node11', // Optional
      unitRadius: 100, // Optional
      preventOverlap: true, // Optional, must be used with nodeSize
      nodeSize: 30, // Optional
      strictRadial: false, // Optional
      workerEnabled: false, // Optional, enable web-worker
    }
  },
  {
    type: 'force',
    label: 'force',

    preventOverlap: true,
    // center: [200, 200], // Optional, default is the center of the graph
    linkDistance: 100, // Optional, edge length
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
    },
  },
  {
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
  },
  {
    type: 'd3-force',
    collide: {
      //   // Prevent nodes from overlapping by specifying a collision radius for each node.
      radius: (d: NodeData) => {
        const size = d.style?.size
        if (Array.isArray(size) && size.length > 0) {
          return size[0] * 2
        } else {
          return 20
        }
        // return d.style && Array.isArray(d.style.size) ? d.style.size[0] * 2 : (typeof d.style.size === 'number' ? d.style.size : 0)
      }
    },
    // link: {
    //   distance: 150,
    //   strength: 2
    // },
    // preventOverlap: true,
    // nodeStrength: -100,   // Repulsion force between nodes
    // linkDistance: 100,   // Distance between connected nodes
    // collide: {
    //   radius: 40,
    // },

  },
  {
    type: 'concentric',
    label: 'concentric',
    maxLevelDiff: 0.5,
    sortBy: 'degree',
    // center: [200, 200], // Optional
    // linkDistance: 50, // Optional, edge length
    // preventOverlap: true, // Optional, must be used with nodeSize
    // nodeSize: 30, // Optional
    // sweep: 10, // Optional
    // equidistant: false, // Optional
    // startAngle: 0, // Optional
    // clockwise: false, // Optional
    // maxLevelDiff: 10, // Optional
    // sortBy: 'degree', // Optional
    // workerEnabled: false, // Optional, enable web-worker
  },
  {
    type: 'antv-dagre',
    label: 'dagre',

    nodeSize: [60, 30],
    nodesep: 60,
    ranksep: 40,
    controlPoints: true,
    rankdir: 'LR', // Optional, default is the center of the graph
    // align: 'DL', // Optional
    // nodesep: 20, // Optional
    // ranksep: 50, // Optional
    // controlPoints: true, // Optional
  },
  {
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
  },
];