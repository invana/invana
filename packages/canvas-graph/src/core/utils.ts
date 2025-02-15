import { GraphinProps } from "@antv/graphin";
import {
  CanvasGraphBehavior, CanvasGraphPlugin, CanvasGraphProps,
  CanvasGraphTransform
} from "../types";


export const convertToGraphinOptions = (props: CanvasGraphProps): GraphinProps => {
  console.log("convertToGraphinOptions", props);
  return {
    options: {
      behaviors: props.options.behaviors || [],
      plugins: props.options.plugins || [],
      // transforms: props.options.transforms || [],
      layout: props.options.layout || undefined,
      // data: props.initData || { nodes: [], edges: []}
    },
  }
}



export const getUniqueItemsByItem = (options: CanvasGraphPlugin[] | CanvasGraphBehavior[] | CanvasGraphTransform[]) => {
  const uniqueItems = options.reduce((acc, item) => {
    acc[item.type] = item
    return acc
  }, {} as Record<string, CanvasGraphPlugin | CanvasGraphBehavior | CanvasGraphTransform>)
  return Object.values(uniqueItems)
}