import { CanvasGraphTransform } from "../manager/types";


export const MAP_NODE_SIZE_TRANSFORMER: CanvasGraphTransform = {
  type: 'map-node-size',
  key: 'map-node-size',
  scale: 'linear',
  maxSize: 60,
  minSize: 20,
  mapLabelSize: [12, 24]
}