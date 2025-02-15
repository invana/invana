import { GraphinProps } from "@antv/graphin";
import { CanvasGraphProps } from "../types";


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