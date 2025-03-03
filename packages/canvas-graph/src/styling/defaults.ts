
import { CanvasNodeStyle, CanvasEdgeStyle, ICanvasStyle } from "@invana/data-store"
import { getInitialTheme } from "@invana/ui"
import { mergeDeep } from "@invana/data-store";
import { CanvasGraphOptions, ICanvasStyleOptions } from "../types";


export const DEFAULT_NODE_STYLE: CanvasNodeStyle = { // https://g6.antv.antgroup.com/en/examples/element/label/#background
  shape: {
    type: 'circle',
    size: 20,
    halo: false,
    bgColor: '#6a994e',
    bgOpacity: 1,
    // borderColor: '#565656',
  },
  label: {
    textColor: '#ffffff',
    textFontSize: 8,
    textPosition: 'top',
    textAutoRotate: true
  },

  fields: {
    labelField: 'id'
  }
}

export const DEFAULT_EDGE_STYLE: CanvasEdgeStyle = {  // https://g6.antv.antgroup.com/en/examples/element/label/#background
  shape: {
    type: 'line', // 'quadratic', 'cubic-vertical',  'cubic-horizontal',
    halo: false,
    strokeWidth: 1.5,
    strokeColor: '#cad2c5',
    strokeOpacity: 0.4,
  },
  label: {
    textColor: '#999999',
    textFontSize: 8,
    textPosition: 'center',
    textAutoRotate: true,
    textOpacity: 1
  },
  fields: {
    labelField: undefined
  }
}

export const DEFAULT_CANVAS_STYLE: Partial<ICanvasStyle> = {
  theme: getInitialTheme(),
  bgColor: '#222222',
  colorNodesBy: 'type',
  colorEdgesBy: 'type',
  animation: false
}

export const DEFAULT_STYLE_OPTIONS: ICanvasStyleOptions = {
  defaultNode: DEFAULT_NODE_STYLE,
  defaultEdge: DEFAULT_EDGE_STYLE,
  canvas: DEFAULT_CANVAS_STYLE
}

export const MODEL_STYLE_OPTIONS: ICanvasStyleOptions = {
  defaultNode: DEFAULT_NODE_STYLE,
  defaultEdge: mergeDeep(
    {
      shape: {
        type: 'line',
        strokeOpacity: 1
      },
      label: {
        textOpacity: 1
      }
    },
    DEFAULT_EDGE_STYLE,

  ),
  canvas: DEFAULT_CANVAS_STYLE
}

export const DEFAULT_CANVAS_GRAPH_OPTIONS: CanvasGraphOptions = {
  styles: DEFAULT_STYLE_OPTIONS,
  plugins: [],
  behaviors: [],
  transforms: [],
  layout: undefined
}


// plugins: [{ type: 'background', background: '#fff' }],


