import { CanvasGraphTransform } from "../manager/types";


export const MAP_NODE_SIZE_TRANSFORMER: CanvasGraphTransform = {
  // https://g6.antv.antgroup.com/en/api/transforms/map-node-size
  type: 'map-node-size',
  key: 'map-node-size',
  scale: 'log',
  // centrality: 'degree',
  maxSize: 50,
  minSize: 15,
  mapLabelSize: [8, 16],

}

export const PROCESS_PARALLEL_TRANSFORMER: CanvasGraphTransform = {
  type: 'process-parallel-edges',
  key: 'process-parallel-edges',
}